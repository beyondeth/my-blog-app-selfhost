import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager, In } from "typeorm";
import { KnowledgeCompileRun } from "../entities/knowledge-compile-run.entity";
import { KnowledgeEdge } from "../entities/knowledge-edge.entity";
import { KnowledgeFollowupSuggestion } from "../entities/knowledge-followup-suggestion.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import { KnowledgeSource } from "../entities/knowledge-source.entity";
import { PostKnowledgeLink } from "../entities/post-knowledge-link.entity";
import {
  KnowledgeCompilerNodeDraft,
  KnowledgeCompileResult,
  KnowledgeSourceSnapshot,
} from "../knowledge.types";
import { resolveKnowledgeSourceTaxonomy } from "../utils/knowledge-taxonomy.util";
import { clampText, toKnowledgeSlug } from "../utils/knowledge-slug.util";
import { KnowledgeCandidateGraphService } from "./knowledge-candidate-graph.service";

@Injectable()
export class KnowledgeGraphUpsertService {
  private readonly logger = new Logger(KnowledgeGraphUpsertService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly knowledgeCandidateGraphService: KnowledgeCandidateGraphService,
  ) {}

  async markSourceStale(userId: string, postId: string): Promise<void> {
    await this.dataSource
      .getRepository(KnowledgeSource)
      .update({ userId, postId }, { status: "stale" });
  }

  async resetBlogKnowledgeGraph(params: {
    userId: string;
    blogId: string;
    postIds: string[];
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sourceRepo = manager.getRepository(KnowledgeSource);
      const compileRunRepo = manager.getRepository(KnowledgeCompileRun);
      const edgeRepo = manager.getRepository(KnowledgeEdge);
      const linkRepo = manager.getRepository(PostKnowledgeLink);
      const followupRepo = manager.getRepository(KnowledgeFollowupSuggestion);

      const dedupedPostIds = Array.from(
        new Set(params.postIds.filter(Boolean)),
      );
      const sourceQuery = sourceRepo
        .createQueryBuilder("source")
        .where("source.userId = :userId", { userId: params.userId });

      if (dedupedPostIds.length > 0) {
        sourceQuery.andWhere(
          "(source.blogId = :blogId OR source.postId IN (:...postIds))",
          {
            blogId: params.blogId,
            postIds: dedupedPostIds,
          },
        );
      } else {
        sourceQuery.andWhere("source.blogId = :blogId", {
          blogId: params.blogId,
        });
      }

      const sources = await sourceQuery.getMany();
      const sourceIds = sources.map((source) => source.id);
      const scopedPostIds = Array.from(
        new Set([
          ...dedupedPostIds,
          ...sources.map((source) => source.postId).filter(Boolean),
        ]),
      );

      const links =
        scopedPostIds.length > 0
          ? await linkRepo.find({
              where: {
                userId: params.userId,
                postId: In(scopedPostIds),
              },
            })
          : [];
      const affectedNodeIds = links.map((link) => link.nodeId);

      if (sourceIds.length > 0) {
        await edgeRepo.delete({
          userId: params.userId,
          sourceId: In(sourceIds),
        });
      }

      if (scopedPostIds.length > 0) {
        await Promise.all([
          linkRepo.delete({
            userId: params.userId,
            postId: In(scopedPostIds),
          }),
          followupRepo.delete({
            userId: params.userId,
            postId: In(scopedPostIds),
          }),
          compileRunRepo
            .createQueryBuilder()
            .delete()
            .where("userId = :userId", { userId: params.userId })
            .andWhere("postId IN (:...postIds)", { postIds: scopedPostIds })
            .execute(),
        ]);
      } else {
        await compileRunRepo
          .createQueryBuilder()
          .delete()
          .where("userId = :userId", { userId: params.userId })
          .andWhere("blogId = :blogId", { blogId: params.blogId })
          .execute();
      }

      if (sourceIds.length > 0) {
        await sourceRepo.delete({
          userId: params.userId,
          id: In(sourceIds),
        });
      }

      await this.knowledgeCandidateGraphService.resetBlogKnowledge(
        {
          userId: params.userId,
          blogId: params.blogId,
          postIds: scopedPostIds,
        },
        manager,
      );

      await this.recalculateNodeStats(manager, affectedNodeIds);
      await this.pruneOrphanNodes(manager, params.userId);
    });
  }

  async syncCompiledPost(params: {
    userId: string;
    blogId?: string | null;
    postId: string;
    postVersion: number;
    contentHash: string;
    snapshot: KnowledgeSourceSnapshot;
    compileResult: KnowledgeCompileResult;
    compileRunId: string;
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sourceRepo = manager.getRepository(KnowledgeSource);
      const edgeRepo = manager.getRepository(KnowledgeEdge);
      const linkRepo = manager.getRepository(PostKnowledgeLink);
      const followupRepo = manager.getRepository(KnowledgeFollowupSuggestion);
      const compileRunRepo = manager.getRepository(KnowledgeCompileRun);

      let source = await sourceRepo.findOne({
        where: { userId: params.userId, postId: params.postId },
      });

      if (!source) {
        source = sourceRepo.create({
          userId: params.userId,
          blogId: params.blogId || null,
          postId: params.postId,
        });
      }

      source.blogId = params.blogId || null;
      source.postVersion = params.postVersion;
      source.contentHash = params.contentHash;
      source.normalizedPayload = params.snapshot as unknown as Record<string, unknown>;
      source.outboundUrls = params.snapshot.outboundUrls;
      source.status = "compiled";
      source.compiledAt = new Date();
      source.lastError = null;
      source = await sourceRepo.save(source);

      const previousLinks = await linkRepo.find({
        where: { userId: params.userId, postId: params.postId },
      });
      const affectedNodeIds = new Set(previousLinks.map((link) => link.nodeId));

      await Promise.all([
        edgeRepo.delete({ userId: params.userId, sourceId: source.id }),
        linkRepo.delete({ userId: params.userId, postId: params.postId }),
        followupRepo.delete({ userId: params.userId, postId: params.postId }),
      ]);

      const normalizedCompileResult = this.normalizeCompileResultForStorage(
        params.snapshot,
        params.compileResult,
      );
      const candidateSyncResult =
        await this.knowledgeCandidateGraphService.syncCompiledKnowledge(
          {
            userId: params.userId,
            blogId: params.blogId || null,
            postId: params.postId,
            sourceId: source.id,
            contentHash: params.contentHash,
            snapshot: params.snapshot,
            compileResult: normalizedCompileResult,
          },
          manager,
        );
      const approvedCompileResult = candidateSyncResult.requestedFocusGraph;
      const draftNodes = [
        ...approvedCompileResult.primaryNodes,
        ...approvedCompileResult.secondaryNodes,
      ];
      const nodeMap = new Map<string, KnowledgeNode>();
      for (const draft of draftNodes) {
        await this.ensureNode(
          manager,
          params.userId,
          draft.slug,
          draft.title,
          draft.nodeType,
          draft.parentSlug || null,
          draft.summary || null,
          nodeMap,
        );
      }

      for (const edge of approvedCompileResult.edges) {
        const fromNode = await this.findNodeBySlug(
          manager,
          params.userId,
          edge.fromSlug,
          nodeMap,
        );
        const toNode = await this.findNodeBySlug(
          manager,
          params.userId,
          edge.toSlug,
          nodeMap,
        );

        if (!fromNode || !toNode) {
          continue;
        }

        await edgeRepo.save(
          edgeRepo.create({
            userId: params.userId,
            sourceId: source.id,
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
            relationType: edge.relation,
            confidence:
              typeof edge.confidence === "number" ? edge.confidence : null,
            reason: edge.reason || null,
            evidenceCount: 1,
          }),
        );
        affectedNodeIds.add(fromNode.id);
        affectedNodeIds.add(toNode.id);
      }

      for (const postLink of approvedCompileResult.postLinks) {
        const node = await this.findNodeBySlug(
          manager,
          params.userId,
          postLink.nodeSlug,
          nodeMap,
        );
        if (!node) {
          continue;
        }

        await linkRepo.save(
          linkRepo.create({
            userId: params.userId,
            postId: params.postId,
            nodeId: node.id,
            sourceId: source.id,
            role: postLink.role,
            confidence:
              typeof postLink.confidence === "number"
                ? postLink.confidence
                : null,
          }),
        );
        affectedNodeIds.add(node.id);
      }

      for (const followup of approvedCompileResult.followups) {
        const node = followup.nodeSlug
          ? await this.findNodeBySlug(
              manager,
              params.userId,
              followup.nodeSlug,
              nodeMap,
            )
          : null;
        await followupRepo.save(
          followupRepo.create({
            userId: params.userId,
            postId: params.postId,
            nodeId: node?.id || null,
            title: clampText(followup.title, 240),
            reason: clampText(followup.reason, 600),
            status: "pending",
          }),
        );
      }

      await this.recalculateNodeStats(manager, Array.from(affectedNodeIds));

      await compileRunRepo.update(
        { id: params.compileRunId },
        {
          status: "compiled",
          mode: approvedCompileResult.mode,
          completedAt: new Date(),
          resultSummary: {
            primaryNodeCount: approvedCompileResult.primaryNodes.length,
            secondaryNodeCount: approvedCompileResult.secondaryNodes.length,
            edgeCount: approvedCompileResult.edges.length,
            followupCount: approvedCompileResult.followups.length,
          },
          error: null,
        },
      );
    });
  }

  async removePostEvidence(params: {
    userId: string;
    postId: string;
    reason: "unpublished" | "deleted" | "permanent-delete";
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sourceRepo = manager.getRepository(KnowledgeSource);
      const linkRepo = manager.getRepository(PostKnowledgeLink);
      const edgeRepo = manager.getRepository(KnowledgeEdge);
      const followupRepo = manager.getRepository(KnowledgeFollowupSuggestion);

      const source = await sourceRepo.findOne({
        where: { userId: params.userId, postId: params.postId },
      });
      const links = await linkRepo.find({
        where: { userId: params.userId, postId: params.postId },
      });
      const affectedNodeIds = links.map((link) => link.nodeId);

      await Promise.all([
        linkRepo.delete({ userId: params.userId, postId: params.postId }),
        followupRepo.delete({ userId: params.userId, postId: params.postId }),
        source
          ? edgeRepo.delete({ userId: params.userId, sourceId: source.id })
          : Promise.resolve(),
      ]);

      if (source) {
        source.status = params.reason === "deleted" ? "deleted" : "stale";
        source.lastError = null;
        await sourceRepo.save(source);
      }

      await this.knowledgeCandidateGraphService.removePostKnowledge(
        {
          userId: params.userId,
          blogId: source?.blogId ?? null,
          postId: params.postId,
        },
        manager,
      );

      await this.recalculateNodeStats(manager, affectedNodeIds);
      await this.pruneOrphanNodes(manager, params.userId);
    });
  }

  async markCompileFailed(params: {
    compileRunId: string;
    userId: string;
    postId: string;
    error: string;
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KnowledgeCompileRun).update(
        { id: params.compileRunId },
        {
          status: "failed",
          error: clampText(params.error, 1000),
          completedAt: new Date(),
        },
      );

      await manager.getRepository(KnowledgeSource).update(
        { userId: params.userId, postId: params.postId },
        {
          status: "failed",
          lastError: clampText(params.error, 1000),
        },
      );
    });
  }

  async markCompileSkipped(params: {
    compileRunId: string;
    userId: string;
    postId: string;
    contentHash: string;
  }): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(KnowledgeCompileRun).update(
        { id: params.compileRunId },
        {
          status: "skipped",
          completedAt: new Date(),
        },
      );

      await manager.getRepository(KnowledgeSource).update(
        { userId: params.userId, postId: params.postId },
        {
          contentHash: params.contentHash,
          status: "compiled",
          compiledAt: new Date(),
          lastError: null,
        },
      );
    });
  }

  private async ensureNode(
    manager: EntityManager,
    userId: string,
    slug: string,
    title: string,
    nodeType: KnowledgeNode["nodeType"],
    parentSlug: string | null,
    summary: string | null,
    nodeMap: Map<string, KnowledgeNode>,
  ): Promise<KnowledgeNode> {
    const normalizedSlug = toKnowledgeSlug(slug);
    if (nodeMap.has(normalizedSlug)) {
      return nodeMap.get(normalizedSlug)!;
    }

    const normalizedParentSlug = parentSlug ? toKnowledgeSlug(parentSlug) : null;
    const safeParentSlug =
      normalizedParentSlug && normalizedParentSlug !== normalizedSlug
        ? normalizedParentSlug
        : null;

    if (normalizedParentSlug && normalizedParentSlug === normalizedSlug) {
      this.logger.warn(
        `[KB_SELF_PARENT_GUARD] userId=${userId} slug=${normalizedSlug} requestedParent=${normalizedParentSlug}`,
      );
    }

    const nodeRepo = manager.getRepository(KnowledgeNode);
    let parentNode: KnowledgeNode | null = null;
    if (safeParentSlug) {
      parentNode = await this.ensureNode(
        manager,
        userId,
        safeParentSlug,
        this.titleFromSlug(safeParentSlug),
        "domain",
        null,
        null,
        nodeMap,
      );
    }

    let node = await nodeRepo.findOne({
      where: { userId, slug: normalizedSlug },
    });

    if (!node) {
      node = nodeRepo.create({
        userId,
        slug: normalizedSlug,
      });
    }

    node.title = clampText(title || this.titleFromSlug(normalizedSlug), 200);
    node.nodeType = nodeType;
    node.parentNodeId =
      parentNode && parentNode.id !== node.id ? parentNode.id : null;
    node.canonicalPath = parentNode && parentNode.id !== node.id
      ? `${parentNode.canonicalPath}/${normalizedSlug}`
      : normalizedSlug;
    node.summary = summary ? clampText(summary, 400) : node.summary || null;
    node.status = "active";
    node.lastCompiledAt = new Date();
    node = await nodeRepo.save(node);
    nodeMap.set(normalizedSlug, node);
    return node;
  }

  private async findNodeBySlug(
    manager: EntityManager,
    userId: string,
    slug: string,
    nodeMap: Map<string, KnowledgeNode>,
  ): Promise<KnowledgeNode | null> {
    const normalizedSlug = toKnowledgeSlug(slug);
    if (nodeMap.has(normalizedSlug)) {
      return nodeMap.get(normalizedSlug)!;
    }

    const node = await manager.getRepository(KnowledgeNode).findOne({
      where: { userId, slug: normalizedSlug },
    });
    if (node) {
      nodeMap.set(normalizedSlug, node);
    }
    return node;
  }

  private async recalculateNodeStats(
    manager: EntityManager,
    nodeIds: string[],
  ): Promise<void> {
    const nodeRepo = manager.getRepository(KnowledgeNode);
    const pendingIds = Array.from(new Set(nodeIds.filter(Boolean)));
    const expandedIds = new Set<string>(pendingIds);

    while (pendingIds.length > 0) {
      const currentBatch = pendingIds.splice(0, pendingIds.length);
      const currentNodes = await nodeRepo.find({
        where: { id: In(currentBatch) },
      });
      for (const node of currentNodes) {
        if (node.parentNodeId && !expandedIds.has(node.parentNodeId)) {
          expandedIds.add(node.parentNodeId);
          pendingIds.push(node.parentNodeId);
        }
      }
    }

    const dedupedNodeIds = Array.from(expandedIds);
    if (dedupedNodeIds.length === 0) {
      return;
    }
    const nodes = await nodeRepo.find({
      where: { id: In(dedupedNodeIds) },
    });
    const childCounts = await nodeRepo
      .createQueryBuilder("node")
      .select("node.parentNodeId", "parentNodeId")
      .addSelect("COUNT(*)", "count")
      .where("node.parentNodeId IN (:...nodeIds)", { nodeIds: dedupedNodeIds })
      .andWhere("node.status = :status", { status: "active" })
      .groupBy("node.parentNodeId")
      .getRawMany<{ parentNodeId: string; count: string }>();
    const childCountMap = new Map(
      childCounts.map((row) => [row.parentNodeId, Number(row.count)]),
    );

    for (const node of nodes) {
      const linkCount = await manager.getRepository(PostKnowledgeLink).count({
        where: { nodeId: node.id },
      });
      node.postCount = linkCount;
      node.evidenceCount = linkCount;
      const activeChildren = childCountMap.get(node.id) || 0;
      node.status = linkCount === 0 && activeChildren === 0 ? "archived" : "active";
      await nodeRepo.save(node);
    }
  }

  private async pruneOrphanNodes(
    manager: EntityManager,
    userId: string,
  ): Promise<void> {
    const nodeRepo = manager.getRepository(KnowledgeNode);

    while (true) {
      const orphanRows = await nodeRepo
        .createQueryBuilder("node")
        .select("node.id", "id")
        .where("node.userId = :userId", { userId })
        .andWhere("node.status = :status", { status: "active" })
        .andWhere("node.postCount = 0")
        .andWhere("node.evidenceCount = 0")
        .andWhere((qb) => {
          const childQuery = qb
            .subQuery()
            .select("1")
            .from(KnowledgeNode, "child")
            .where("child.parentNodeId = node.id")
            .andWhere("child.status = :childStatus")
            .getQuery();
          return `NOT EXISTS ${childQuery}`;
        })
        .setParameter("childStatus", "active")
        .limit(500)
        .getRawMany<{ id: string }>();

      const orphanIds = orphanRows
        .map((row) => row.id)
        .filter((value): value is string => Boolean(value));

      if (orphanIds.length === 0) {
        return;
      }

      await nodeRepo.update({ id: In(orphanIds) }, { status: "archived" });
    }
  }

  private titleFromSlug(slug: string): string {
    return slug
      .split("-")
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" ");
  }

  private normalizeCompileResultForStorage(
    snapshot: KnowledgeSourceSnapshot,
    compileResult: KnowledgeCompileResult,
  ): KnowledgeCompileResult {
    const taxonomy = resolveKnowledgeSourceTaxonomy(snapshot);
    const primaryTitleFromDraft =
      compileResult.primaryNodes.find((node) =>
        this.matchesTaxonomyPrimary(node, taxonomy.root.slug, taxonomy.topic?.slug),
      )?.title || null;
    const primarySummaryFromDraft =
      compileResult.primaryNodes.find((node) =>
        this.matchesTaxonomyPrimary(node, taxonomy.root.slug, taxonomy.topic?.slug),
      )?.summary || null;
    const fallbackPrimaryTitle = clampText(
      snapshot.tags[0] || snapshot.title || taxonomy.root.title,
      160,
    );
    const shouldUseFallbackTopic =
      !taxonomy.topic &&
      taxonomy.root.generic &&
      fallbackPrimaryTitle &&
      toKnowledgeSlug(fallbackPrimaryTitle) !== taxonomy.root.slug;
    const primaryNode: KnowledgeCompilerNodeDraft = taxonomy.topic
      ? {
          slug: taxonomy.topic.slug,
          title: taxonomy.topic.title,
          nodeType: "topic",
          parentSlug: taxonomy.root.slug,
          summary: primarySummaryFromDraft || snapshot.excerpt || null,
        }
      : shouldUseFallbackTopic
        ? {
            slug: toKnowledgeSlug(fallbackPrimaryTitle),
            title: fallbackPrimaryTitle,
            nodeType: "topic",
            parentSlug: taxonomy.root.slug,
            summary: primarySummaryFromDraft || snapshot.excerpt || null,
          }
        : {
            slug: taxonomy.root.slug,
            title: taxonomy.root.title,
            nodeType: "domain",
            parentSlug: null,
            summary: primarySummaryFromDraft || snapshot.excerpt || null,
          };

    const primarySlug = primaryNode.slug;
    const secondaryNodes = this.dedupeNodeDrafts(
      compileResult.secondaryNodes
        .map((node) => ({
          slug: toKnowledgeSlug(node.slug || node.title),
          title: clampText(node.title || this.titleFromSlug(node.slug), 160),
          nodeType: "concept" as const,
          parentSlug: primarySlug,
          summary: node.summary ? clampText(node.summary, 400) : null,
        }))
        .filter(
          (node) => node.slug !== primarySlug && node.slug !== taxonomy.root.slug,
        ),
    );
    const validNodeSlugs = new Set<string>([
      primarySlug,
      taxonomy.root.slug,
      ...secondaryNodes.map((node) => node.slug),
    ]);

    const remapDraftSlug = (value: string | null | undefined) => {
      const normalized = toKnowledgeSlug(value || "");
      if (!normalized || normalized === "untitled-node") {
        return null;
      }
      if (
        normalized === taxonomy.root.slug ||
        normalized === taxonomy.topic?.slug ||
        normalized === primarySlug ||
        snapshot.categorySegments
          .map((segment) => toKnowledgeSlug(segment))
          .includes(normalized)
      ) {
        return primarySlug;
      }
      if (validNodeSlugs.has(normalized)) {
        return normalized;
      }
      return null;
    };

    const postLinks = this.dedupePostLinks(
      compileResult.postLinks
        .map((postLink) => ({
          ...postLink,
          nodeSlug: remapDraftSlug(postLink.nodeSlug),
        }))
        .filter(
          (
            postLink,
          ): postLink is KnowledgeCompileResult["postLinks"][number] & {
            nodeSlug: string;
          } => Boolean(postLink.nodeSlug),
        ),
    );

    const edges = this.dedupeEdges(
      compileResult.edges
        .map((edge) => {
          const fromSlug = remapDraftSlug(edge.fromSlug);
          const toSlug = remapDraftSlug(edge.toSlug);
          if (!fromSlug || !toSlug || fromSlug === toSlug) {
            return null;
          }

          return {
            ...edge,
            fromSlug,
            toSlug,
          };
        })
        .filter(
          (edge): edge is KnowledgeCompileResult["edges"][number] => Boolean(edge),
        ),
    );

    const followups = this.dedupeFollowups(
      compileResult.followups.map((followup) => ({
        ...followup,
        nodeSlug: followup.nodeSlug ? remapDraftSlug(followup.nodeSlug) : null,
      })),
    );

    return {
      mode: compileResult.mode,
      primaryNodes: [
        {
          ...primaryNode,
          title: clampText(
            primaryTitleFromDraft || primaryNode.title || taxonomy.root.title,
            160,
          ),
        },
      ],
      secondaryNodes,
      edges,
      postLinks: postLinks.length
        ? postLinks
        : [{ nodeSlug: primarySlug, role: "primary", confidence: 0.8 }],
      followups,
    };
  }

  private matchesTaxonomyPrimary(
    node: KnowledgeCompilerNodeDraft,
    rootSlug: string,
    topicSlug?: string | null,
  ) {
    const slug = toKnowledgeSlug(node.slug || node.title);
    return slug === rootSlug || slug === topicSlug;
  }

  private dedupeNodeDrafts(nodes: KnowledgeCompilerNodeDraft[]) {
    const map = new Map<string, KnowledgeCompilerNodeDraft>();
    for (const node of nodes) {
      if (!node.slug || map.has(node.slug)) {
        continue;
      }
      map.set(node.slug, node);
    }
    return Array.from(map.values());
  }

  private dedupePostLinks(postLinks: KnowledgeCompileResult["postLinks"]) {
    const map = new Map<string, KnowledgeCompileResult["postLinks"][number]>();
    for (const postLink of postLinks) {
      const existing = map.get(postLink.nodeSlug);
      if (!existing) {
        map.set(postLink.nodeSlug, postLink);
        continue;
      }

      const existingScore = this.scorePostLink(existing);
      const nextScore = this.scorePostLink(postLink);
      if (nextScore > existingScore) {
        map.set(postLink.nodeSlug, postLink);
      }
    }
    return Array.from(map.values());
  }

  private scorePostLink(postLink: KnowledgeCompileResult["postLinks"][number]) {
    const roleScore = postLink.role === "primary" ? 2 : 1;
    const confidenceScore =
      typeof postLink.confidence === "number" && Number.isFinite(postLink.confidence)
        ? postLink.confidence
        : 0;
    return roleScore * 10 + confidenceScore;
  }

  private dedupeEdges(edges: KnowledgeCompileResult["edges"]) {
    const map = new Map<string, KnowledgeCompileResult["edges"][number]>();
    for (const edge of edges) {
      const key = `${edge.fromSlug}:${edge.relation}:${edge.toSlug}`;
      if (map.has(key)) {
        continue;
      }
      map.set(key, edge);
    }
    return Array.from(map.values());
  }

  private dedupeFollowups(
    followups: KnowledgeCompileResult["followups"],
  ): KnowledgeCompileResult["followups"] {
    const map = new Map<string, KnowledgeCompileResult["followups"][number]>();
    for (const followup of followups) {
      const key = `${followup.nodeSlug || "none"}:${followup.title}`;
      if (map.has(key)) {
        continue;
      }
      map.set(key, followup);
    }
    return Array.from(map.values());
  }
}
