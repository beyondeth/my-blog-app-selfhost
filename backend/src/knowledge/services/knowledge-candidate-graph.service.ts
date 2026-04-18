import { Injectable, Logger } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import {
  DataSource,
  EntityManager,
  IsNull,
} from "typeorm";
import { Blog } from "../../blogs/entities/blog.entity";
import { Post } from "../../posts/entities/post.entity";
import { KnowledgeAliasEntity } from "../entities/knowledge-alias.entity";
import { KnowledgeCandidateEdgeEntity } from "../entities/knowledge-candidate-edge.entity";
import { KnowledgeCandidateNodeEntity } from "../entities/knowledge-candidate-node.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import { KnowledgeSource } from "../entities/knowledge-source.entity";
import { KnowledgeSourceArtifact } from "../entities/knowledge-source-artifact.entity";
import { PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES } from "../knowledge.constants";
import {
  KnowledgeArtifactSectionNode,
  KnowledgeCompileResult,
  KnowledgeDraft,
  KnowledgeRelationType,
  KnowledgeSourceSnapshot,
} from "../knowledge.types";
import {
  resolveKnowledgeSeedRoot,
  resolveKnowledgeSourceTaxonomy,
} from "../utils/knowledge-taxonomy.util";
import { clampText, toKnowledgeSlug } from "../utils/knowledge-slug.util";
import { KnowledgeArtifactService } from "./knowledge-artifact.service";

interface CandidateNodeEvidence {
  postId: string;
  sourceId: string | null;
  artifactId: string;
  role: "root" | "primary" | "secondary" | "draft";
  confidence: number | null;
  refs: string[];
}

interface CandidateEdgeEvidence {
  postId: string;
  sourceId: string | null;
  artifactId: string;
  confidence: number | null;
  refs: string[];
}

interface CandidateNodeDraftRecord {
  slug: string;
  title: string;
  nodeType: KnowledgeNode["nodeType"];
  parentSlug: string | null;
  summary: string | null;
  aliases: string[];
  role: CandidateNodeEvidence["role"];
  confidence: number | null;
  refs: string[];
}

interface CandidateEdgeDraftRecord {
  fromSlug: string;
  toSlug: string;
  relation: KnowledgeRelationType;
  reason: string | null;
  confidence: number | null;
  refs: string[];
}

interface ArtifactSectionIndexItem {
  id: string;
  slug: string;
  title: string;
  normalizedTitle: string;
  summary: string | null;
}

function isPublicKnowledgeMapRelationType(
  relationType: KnowledgeRelationType,
): relationType is (typeof PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES)[number] {
  return (PUBLIC_KNOWLEDGE_MAP_RELATION_TYPES as readonly KnowledgeRelationType[]).includes(
    relationType,
  );
}

export interface KnowledgeCandidateSyncResult {
  requestedFocusGraph: KnowledgeCompileResult;
  approvedSlugByCandidateSlug: Record<string, string>;
  parentSlugByCandidateSlug: Record<string, string | null>;
}

@Injectable()
export class KnowledgeCandidateGraphService {
  private readonly logger = new Logger(KnowledgeCandidateGraphService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly knowledgeArtifactService: KnowledgeArtifactService,
  ) {}

  async syncCompiledKnowledge(
    params: {
      userId: string;
      blogId?: string | null;
      postId: string;
      sourceId: string;
      contentHash: string;
      snapshot: KnowledgeSourceSnapshot;
      compileResult: KnowledgeCompileResult;
    },
    manager?: EntityManager,
  ): Promise<KnowledgeCandidateSyncResult> {
    const executor = manager ?? this.dataSource.manager;
    const artifactRepo = executor.getRepository(KnowledgeSourceArtifact);

    const existingArtifact = await artifactRepo.findOne({
      where: {
        userId: params.userId,
        postId: params.postId,
        blogId: params.blogId ?? IsNull(),
      },
    });
    const draft = (existingArtifact?.draftPayload as KnowledgeDraft | null) ?? null;
    const artifactPayload = this.knowledgeArtifactService.buildArtifact({
      source: params.snapshot,
      compileResult: params.compileResult,
      draft,
    });
    const sectionIndex = this.flattenArtifactSections(artifactPayload.sectionTree);

    const artifact =
      existingArtifact ??
      artifactRepo.create({
        userId: params.userId,
        blogId: params.blogId ?? null,
        postId: params.postId,
      });
    artifact.blogId = params.blogId ?? null;
    artifact.sourceId = params.sourceId;
    artifact.contentHash = params.contentHash;
    artifact.artifact = artifactPayload as unknown as Record<string, unknown>;
    artifact.draftPayload = draft as unknown as Record<string, unknown> | null;
    artifact.status = "active";
    const savedArtifact = await artifactRepo.save(artifact);

    const nodeDrafts = this.buildCandidateNodeDrafts(
      params.snapshot,
      params.compileResult,
      draft,
      sectionIndex,
    );
    const nodeSectionRefsBySlug = new Map(
      nodeDrafts.map((node) => [
        node.slug,
        node.refs.filter((ref) => ref.startsWith("section:")),
      ]),
    );
    const edgeDrafts = this.buildCandidateEdgeDrafts(
      params.compileResult,
      draft,
      nodeSectionRefsBySlug,
    );

    const approvedSlugByCandidateSlug: Record<string, string> = {};
    const parentSlugByCandidateSlug: Record<string, string | null> = {};
    const approvedNodeSlugs = new Set<string>();

    for (const nodeDraft of nodeDrafts) {
      parentSlugByCandidateSlug[nodeDraft.slug] = nodeDraft.parentSlug;
      const candidate = await this.upsertCandidateNode(
        {
          userId: params.userId,
          blogId: params.blogId ?? null,
          postId: params.postId,
          sourceId: params.sourceId,
          artifactId: savedArtifact.id,
          draft: nodeDraft,
        },
        executor,
      );

      if (candidate.canonicalNodeId) {
        const approvedNode = await executor.getRepository(KnowledgeNode).findOne({
          where: { id: candidate.canonicalNodeId },
        });
        if (approvedNode) {
          approvedSlugByCandidateSlug[nodeDraft.slug] = approvedNode.slug;
          approvedNodeSlugs.add(approvedNode.slug);
        }
      }
    }

    for (const edgeDraft of edgeDrafts) {
      await this.upsertCandidateEdge(
        {
          userId: params.userId,
          blogId: params.blogId ?? null,
          postId: params.postId,
          sourceId: params.sourceId,
          artifactId: savedArtifact.id,
          draft: edgeDraft,
        },
        executor,
      );
    }

    return {
      requestedFocusGraph: this.buildApprovedCompileResult(
        params.compileResult,
        approvedNodeSlugs,
        approvedSlugByCandidateSlug,
        parentSlugByCandidateSlug,
      ),
      approvedSlugByCandidateSlug,
      parentSlugByCandidateSlug,
    };
  }

  async submitDraft(params: {
    userId: string;
    postId: string;
    draft: KnowledgeDraft;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const post = await manager.getRepository(Post).findOne({
        where: { id: params.postId, authorId: params.userId },
        relations: ["blog", "metadata"],
      });
      if (!post) {
        return null;
      }

      const artifactRepo = manager.getRepository(KnowledgeSourceArtifact);
      const sourceRepo = manager.getRepository(KnowledgeSource);
      const existingArtifact = await artifactRepo.findOne({
        where: {
          userId: params.userId,
          postId: params.postId,
          blogId: post.blogId ?? IsNull(),
        },
      });
      const source = await sourceRepo.findOne({
        where: { userId: params.userId, postId: params.postId },
      });

      const artifact =
        existingArtifact ??
        artifactRepo.create({
          userId: params.userId,
          blogId: post.blogId ?? null,
          postId: params.postId,
        });
      artifact.blogId = post.blogId ?? null;
      artifact.sourceId = source?.id || null;
      artifact.contentHash = source?.contentHash || "";
      artifact.draftPayload = params.draft as unknown as Record<string, unknown>;
      artifact.status = "active";
      await artifactRepo.save(artifact);

      return artifact;
    });
  }

  async getPostArtifact(params: { userId: string; postId: string }) {
    return this.dataSource.getRepository(KnowledgeSourceArtifact).findOne({
      where: {
        userId: params.userId,
        postId: params.postId,
      },
    });
  }

  async removePostKnowledge(params: {
    userId: string;
    blogId?: string | null;
    postId: string;
  }, manager?: EntityManager) {
    const executor = manager ?? this.dataSource.manager;
    await this.cleanupEvidenceForPosts(
      executor,
      params.userId,
      params.blogId ?? null,
      [params.postId],
    );
  }

  async resetBlogKnowledge(params: {
    userId: string;
    blogId: string;
    postIds: string[];
  }, manager?: EntityManager) {
    const executor = manager ?? this.dataSource.manager;
    await this.cleanupEvidenceForPosts(
      executor,
      params.userId,
      params.blogId,
      params.postIds,
    );
  }

  async getBlogKnowledgeCandidates(params: {
    blog: Blog;
    userId: string;
    status?: "provisional" | "approved" | "rejected";
  }) {
    const nodeRepo = this.dataSource.getRepository(KnowledgeCandidateNodeEntity);
    const edgeRepo = this.dataSource.getRepository(KnowledgeCandidateEdgeEntity);

    const nodeWhere = {
      userId: params.userId,
      blogId: params.blog.id,
      ...(params.status ? { status: params.status } : {}),
    };
    const edgeWhere = {
      userId: params.userId,
      blogId: params.blog.id,
      ...(params.status ? { status: params.status } : {}),
    };

    const [nodes, edges] = await Promise.all([
      nodeRepo.find({
        where: nodeWhere,
        order: { postCount: "DESC", updatedAt: "DESC" },
        take: 100,
      }),
      edgeRepo.find({
        where: edgeWhere,
        order: { postCount: "DESC", updatedAt: "DESC" },
        take: 100,
      }),
    ]);

    return { nodes, edges };
  }

  async approveCandidate(params: {
    userId: string;
    candidateId: string;
  }) {
    return this.dataSource.transaction(async (manager) => {
      const candidateRepo = manager.getRepository(KnowledgeCandidateNodeEntity);
      const candidate = await candidateRepo.findOne({
        where: { id: params.candidateId, userId: params.userId },
      });
      if (!candidate) {
        return null;
      }

      const approvedNode = await this.ensureApprovedNode(
        manager,
        candidate.userId,
        candidate.blogId,
        candidate.slug,
        candidate.title,
        candidate.nodeType,
        candidate.proposedParentSlug,
        candidate.summary,
      );

      candidate.status = "approved";
      candidate.canonicalNodeId = approvedNode.id;
      await candidateRepo.save(candidate);

      return { candidate, approvedNode };
    });
  }

  async rejectCandidate(params: {
    userId: string;
    candidateId: string;
  }) {
    const candidateRepo = this.dataSource.getRepository(KnowledgeCandidateNodeEntity);
    const candidate = await candidateRepo.findOne({
      where: { id: params.candidateId, userId: params.userId },
    });
    if (!candidate) {
      return null;
    }

    candidate.status = "rejected";
    await candidateRepo.save(candidate);
    return candidate;
  }

  private buildCandidateNodeDrafts(
    snapshot: KnowledgeSourceSnapshot,
    compileResult: KnowledgeCompileResult,
    draft: KnowledgeDraft | null,
    sectionIndex: ArtifactSectionIndexItem[] = [],
  ) {
    const taxonomy = resolveKnowledgeSourceTaxonomy(snapshot);
    const map = new Map<string, CandidateNodeDraftRecord>();

    const pushDraft = (node: CandidateNodeDraftRecord) => {
      if (!node.slug || node.slug === "untitled-node") {
        return;
      }

      const existing = map.get(node.slug);
      if (!existing) {
        map.set(node.slug, node);
        return;
      }

      existing.title = existing.title || node.title;
      existing.summary = existing.summary || node.summary;
      existing.nodeType = existing.nodeType || node.nodeType;
      existing.parentSlug = existing.parentSlug || node.parentSlug;
      existing.aliases = Array.from(new Set([...existing.aliases, ...node.aliases]));
      existing.refs = Array.from(new Set([...existing.refs, ...node.refs]));
      if (existing.confidence == null) {
        existing.confidence = node.confidence;
      }
    };

    pushDraft({
      slug: taxonomy.root.slug,
      title: taxonomy.root.title,
      nodeType: "domain",
      parentSlug: null,
      summary: snapshot.excerpt || null,
      aliases: snapshot.categorySegments[0] ? [snapshot.categorySegments[0]] : [],
      role: "root",
      confidence: 0.9,
      refs: this.buildNodeEvidenceRefs(
        sectionIndex,
        [taxonomy.root.title, snapshot.categorySegments[0], snapshot.excerpt],
        snapshot.category ? [`category:${snapshot.category}`] : [],
      ),
    });

    if (taxonomy.topic) {
      pushDraft({
        slug: taxonomy.topic.slug,
        title: taxonomy.topic.title,
        nodeType: "topic",
        parentSlug: taxonomy.root.slug,
        summary: snapshot.excerpt || null,
        aliases: snapshot.categorySegments.at(-1)
          ? [snapshot.categorySegments.at(-1)!]
          : [],
        role: "primary",
        confidence: 0.85,
        refs: this.buildNodeEvidenceRefs(
          sectionIndex,
          [taxonomy.topic.title, snapshot.categorySegments.at(-1), snapshot.excerpt],
          snapshot.category ? [`category:${snapshot.category}`] : [],
        ),
      });
    }

    compileResult.primaryNodes.forEach((node) =>
      pushDraft({
        slug: toKnowledgeSlug(node.slug || node.title),
        title: clampText(node.title || node.slug, 200),
        nodeType: node.nodeType,
        parentSlug: node.parentSlug ? toKnowledgeSlug(node.parentSlug) : null,
        summary: node.summary ? clampText(node.summary, 600) : null,
        aliases: [node.title, node.slug].filter(Boolean) as string[],
        role: "primary",
        confidence: 0.8,
        refs: this.buildNodeEvidenceRefs(
          sectionIndex,
          [node.title, node.slug, node.summary],
          [`primary:${node.slug || node.title}`],
        ),
      }),
    );

    compileResult.secondaryNodes.forEach((node) =>
      pushDraft({
        slug: toKnowledgeSlug(node.slug || node.title),
        title: clampText(node.title || node.slug, 200),
        nodeType: node.nodeType,
        parentSlug: node.parentSlug ? toKnowledgeSlug(node.parentSlug) : null,
        summary: node.summary ? clampText(node.summary, 600) : null,
        aliases: [node.title, node.slug].filter(Boolean) as string[],
        role: "secondary",
        confidence: 0.65,
        refs: this.buildNodeEvidenceRefs(
          sectionIndex,
          [node.title, node.slug, node.summary],
          [`secondary:${node.slug || node.title}`],
        ),
      }),
    );

    draft?.nodes?.forEach((node) =>
      pushDraft({
        slug: toKnowledgeSlug(node.label),
        title: clampText(node.label, 200),
        nodeType: node.nodeType || "concept",
        parentSlug: node.parentLabel ? toKnowledgeSlug(node.parentLabel) : null,
        summary: node.summary ? clampText(node.summary, 600) : null,
        aliases: [node.label],
        role: "draft",
        confidence: typeof node.confidence === "number" ? node.confidence : 0.72,
        refs: this.buildNodeEvidenceRefs(
          sectionIndex,
          [node.label, node.parentLabel, node.summary],
          node.evidenceRefs?.slice(0, 10) || ["draft"],
        ),
      }),
    );

    return Array.from(map.values());
  }

  private buildCandidateEdgeDrafts(
    compileResult: KnowledgeCompileResult,
    draft: KnowledgeDraft | null,
    nodeSectionRefsBySlug: Map<string, string[]> = new Map(),
  ) {
    const map = new Map<string, CandidateEdgeDraftRecord>();

    const pushDraft = (edge: CandidateEdgeDraftRecord) => {
      if (!edge.fromSlug || !edge.toSlug || edge.fromSlug === edge.toSlug) {
        return;
      }
      const key = `${edge.fromSlug}:${edge.relation}:${edge.toSlug}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, edge);
        return;
      }
      existing.refs = Array.from(new Set([...existing.refs, ...edge.refs]));
      existing.reason = existing.reason || edge.reason;
      if (existing.confidence == null) {
        existing.confidence = edge.confidence;
      }
    };

    compileResult.edges.forEach((edge) =>
      pushDraft({
        fromSlug: toKnowledgeSlug(edge.fromSlug),
        toSlug: toKnowledgeSlug(edge.toSlug),
        relation: edge.relation,
        reason: edge.reason ? clampText(edge.reason, 600) : null,
        confidence: typeof edge.confidence === "number" ? edge.confidence : 0.6,
        refs: this.buildEdgeEvidenceRefs(
          [`edge:${edge.fromSlug}:${edge.relation}:${edge.toSlug}`],
          nodeSectionRefsBySlug.get(toKnowledgeSlug(edge.fromSlug)) || [],
          nodeSectionRefsBySlug.get(toKnowledgeSlug(edge.toSlug)) || [],
        ),
      }),
    );

    draft?.edges?.forEach((edge) =>
      pushDraft({
        fromSlug: toKnowledgeSlug(edge.fromLabel),
        toSlug: toKnowledgeSlug(edge.toLabel),
        relation: edge.relation,
        reason: edge.reason ? clampText(edge.reason, 600) : null,
        confidence: typeof edge.confidence === "number" ? edge.confidence : 0.72,
        refs: this.buildEdgeEvidenceRefs(
          edge.evidenceRefs?.slice(0, 10) || ["draft"],
          nodeSectionRefsBySlug.get(toKnowledgeSlug(edge.fromLabel)) || [],
          nodeSectionRefsBySlug.get(toKnowledgeSlug(edge.toLabel)) || [],
        ),
      }),
    );

    return Array.from(map.values());
  }

  private async upsertCandidateNode(
    params: {
      userId: string;
      blogId: string | null;
      postId: string;
      sourceId: string | null;
      artifactId: string;
      draft: CandidateNodeDraftRecord;
    },
    manager: EntityManager,
  ) {
    const candidateRepo = manager.getRepository(KnowledgeCandidateNodeEntity);
    const aliasRepo = manager.getRepository(KnowledgeAliasEntity);

    let candidate = await candidateRepo.findOne({
      where: {
        userId: params.userId,
        blogId: params.blogId ?? IsNull(),
        slug: params.draft.slug,
      },
    });

    if (!candidate) {
      candidate = candidateRepo.create({
        userId: params.userId,
        blogId: params.blogId,
        slug: params.draft.slug,
      });
    }

    const evidence = this.mergeEvidence<CandidateNodeEvidence>(
      candidate.evidence as unknown as CandidateNodeEvidence[] | undefined,
      params.postId,
      {
        postId: params.postId,
        sourceId: params.sourceId,
        artifactId: params.artifactId,
        role: params.draft.role,
        confidence: params.draft.confidence,
        refs: params.draft.refs,
      },
    );

    candidate.title = clampText(params.draft.title || candidate.title || params.draft.slug, 200);
    candidate.nodeType = params.draft.nodeType;
    candidate.proposedParentSlug = params.draft.parentSlug || null;
    candidate.summary = params.draft.summary || candidate.summary || null;
    candidate.aliases = Array.from(
      new Set([
        ...(candidate.aliases || []),
        ...params.draft.aliases.map((alias) => clampText(alias, 160)),
      ]),
    );
    candidate.evidence = evidence as unknown as Array<Record<string, unknown>>;
    candidate.postCount = new Set(evidence.map((item) => item.postId)).size;
    candidate.sourceCount = new Set(
      evidence.map((item) => item.sourceId || item.artifactId),
    ).size;
    candidate.avgConfidence = this.averageConfidence(evidence.map((item) => item.confidence));

    const approvedNode = await this.maybeApproveCandidateNode(candidate, manager);
    if (approvedNode) {
      candidate.status = "approved";
      candidate.canonicalNodeId = approvedNode.id;
    } else if (candidate.status !== "rejected" && candidate.status !== "merged") {
      candidate.status = "provisional";
      candidate.canonicalNodeId = null;
    }

    const savedCandidate = await candidateRepo.save(candidate);

    for (const alias of savedCandidate.aliases || []) {
      const aliasSlug = toKnowledgeSlug(alias);
      if (!aliasSlug || aliasSlug === savedCandidate.slug) {
        continue;
      }
      let aliasRow = await aliasRepo.findOne({
        where: {
          userId: params.userId,
          blogId: params.blogId ?? IsNull(),
          aliasSlug,
        },
      });
      if (!aliasRow) {
        aliasRow = aliasRepo.create({
          userId: params.userId,
          blogId: params.blogId,
          aliasSlug,
        });
      }
      aliasRow.label = clampText(alias, 200);
      aliasRow.candidateNodeId = savedCandidate.id;
      aliasRow.targetNodeId = savedCandidate.canonicalNodeId;
      aliasRow.sourceType = params.draft.role === "draft" ? "draft" : "artifact";
      aliasRow.status = "active";
      await aliasRepo.save(aliasRow);
    }

    return savedCandidate;
  }

  private async upsertCandidateEdge(
    params: {
      userId: string;
      blogId: string | null;
      postId: string;
      sourceId: string | null;
      artifactId: string;
      draft: CandidateEdgeDraftRecord;
    },
    manager: EntityManager,
  ) {
    const edgeRepo = manager.getRepository(KnowledgeCandidateEdgeEntity);
    let candidate = await edgeRepo.findOne({
      where: {
        userId: params.userId,
        blogId: params.blogId ?? IsNull(),
        fromSlug: params.draft.fromSlug,
        toSlug: params.draft.toSlug,
        relationType: params.draft.relation,
      },
    });

    if (!candidate) {
      candidate = edgeRepo.create({
        userId: params.userId,
        blogId: params.blogId,
        fromSlug: params.draft.fromSlug,
        toSlug: params.draft.toSlug,
        relationType: params.draft.relation,
      });
    }

    const evidence = this.mergeEvidence<CandidateEdgeEvidence>(
      candidate.evidence as unknown as CandidateEdgeEvidence[] | undefined,
      params.postId,
      {
        postId: params.postId,
        sourceId: params.sourceId,
        artifactId: params.artifactId,
        confidence: params.draft.confidence,
        refs: params.draft.refs,
      },
    );
    candidate.reason = params.draft.reason || candidate.reason || null;
    candidate.evidence = evidence as unknown as Array<Record<string, unknown>>;
    candidate.postCount = new Set(evidence.map((item) => item.postId)).size;
    candidate.sourceCount = new Set(
      evidence.map((item) => item.sourceId || item.artifactId),
    ).size;
    candidate.avgConfidence = this.averageConfidence(evidence.map((item) => item.confidence));
    const approved = await this.maybeApproveCandidateEdge(candidate, manager);
    candidate.status = approved
      ? "approved"
      : candidate.status === "rejected"
        ? "rejected"
        : "provisional";

    return edgeRepo.save(candidate);
  }

  private async maybeApproveCandidateNode(
    candidate: KnowledgeCandidateNodeEntity,
    manager: EntityManager,
  ) {
    const evidence = (candidate.evidence || []) as unknown as CandidateNodeEvidence[];
    const sectionBackedPostCount = this.countSectionBackedPosts(evidence);
    const seedRoot =
      candidate.nodeType === "domain"
        ? resolveKnowledgeSeedRoot(candidate.title) ??
          resolveKnowledgeSeedRoot(candidate.slug)
        : null;

    if (seedRoot) {
      return this.ensureApprovedNode(
        manager,
        candidate.userId,
        candidate.blogId,
        seedRoot.slug,
        seedRoot.title,
        "domain",
        null,
        candidate.summary,
      );
    }

    if (candidate.nodeType === "domain") {
      if (await this.shouldAutoApproveColdStartDomain(candidate, evidence, manager)) {
        return this.ensureApprovedNode(
          manager,
          candidate.userId,
          candidate.blogId,
          candidate.slug,
          candidate.title,
          candidate.nodeType,
          null,
          candidate.summary,
        );
      }

      if (candidate.postCount < 3 || sectionBackedPostCount < 2) {
        return null;
      }
    } else if (candidate.postCount < 2 || sectionBackedPostCount < 2) {
      return null;
    }

    const approvedParent =
      candidate.proposedParentSlug
        ? await manager.getRepository(KnowledgeNode).findOne({
            where: {
              userId: candidate.userId,
              slug: toKnowledgeSlug(candidate.proposedParentSlug),
            },
          })
        : null;

    if (
      candidate.proposedParentSlug &&
      !approvedParent &&
      (candidate.nodeType === "topic" ||
        candidate.nodeType === "concept" ||
        candidate.nodeType === "question")
    ) {
      return null;
    }

    return this.ensureApprovedNode(
      manager,
      candidate.userId,
      candidate.blogId,
      candidate.slug,
      candidate.title,
      candidate.nodeType,
      approvedParent?.slug || candidate.proposedParentSlug,
      candidate.summary,
    );
  }

  private async shouldAutoApproveColdStartDomain(
    candidate: KnowledgeCandidateNodeEntity,
    evidence: CandidateNodeEvidence[],
    manager: EntityManager,
  ) {
    if (candidate.nodeType !== "domain") {
      return false;
    }

    if (candidate.postCount < 1 || this.countSectionBackedPosts(evidence) < 1) {
      return false;
    }

    const hasRootEvidence = evidence.some((item) => item.role === "root");
    if (!hasRootEvidence) {
      return false;
    }

    const approvedDomains = await manager.getRepository(KnowledgeNode).find({
      where: {
        userId: candidate.userId,
        nodeType: "domain",
        status: "active",
      },
    });

    return approvedDomains.every((node) => this.isGenericRootNode(node));
  }

  private isGenericRootNode(node: Pick<KnowledgeNode, "slug" | "title">) {
    return Boolean(
      resolveKnowledgeSeedRoot(node.slug)?.generic ||
        resolveKnowledgeSeedRoot(node.title)?.generic,
    );
  }

  private async maybeApproveCandidateEdge(
    candidate: KnowledgeCandidateEdgeEntity,
    manager: EntityManager,
  ) {
    const evidence = (candidate.evidence || []) as unknown as CandidateEdgeEvidence[];
    if (!isPublicKnowledgeMapRelationType(candidate.relationType)) {
      return false;
    }
    if (candidate.postCount < 2 || this.countSectionBackedPosts(evidence) < 2) {
      return false;
    }

    const nodeRepo = manager.getRepository(KnowledgeNode);
    const [fromNode, toNode] = await Promise.all([
      nodeRepo.findOne({
        where: {
          userId: candidate.userId,
          slug: toKnowledgeSlug(candidate.fromSlug),
        },
      }),
      nodeRepo.findOne({
        where: {
          userId: candidate.userId,
          slug: toKnowledgeSlug(candidate.toSlug),
        },
      }),
    ]);

    return Boolean(fromNode && toNode);
  }

  private countSectionBackedPosts(
    evidence: Array<{ postId: string; refs: string[] }>,
  ) {
    const postIds = evidence
      .filter((item) =>
        Array.isArray(item.refs) &&
        item.refs.some((ref) => ref.startsWith("section:")),
      )
      .map((item) => item.postId);

    return new Set(postIds).size;
  }

  private async ensureApprovedNode(
    manager: EntityManager,
    userId: string,
    blogId: string | null,
    slug: string,
    title: string,
    nodeType: KnowledgeNode["nodeType"],
    parentSlug: string | null,
    summary: string | null,
  ) {
    const nodeRepo = manager.getRepository(KnowledgeNode);
    const normalizedSlug = toKnowledgeSlug(slug);
    const normalizedParentSlug = parentSlug ? toKnowledgeSlug(parentSlug) : null;

    if (normalizedParentSlug && normalizedParentSlug === normalizedSlug) {
      this.logger.warn(
        `[KB_SELF_PARENT_GUARD] userId=${userId} blogId=${blogId ?? "none"} slug=${normalizedSlug} requestedParent=${normalizedParentSlug}`,
      );
    }

    let parentNode: KnowledgeNode | null = null;
    if (normalizedParentSlug && normalizedParentSlug !== normalizedSlug) {
      parentNode = await nodeRepo.findOne({
        where: { userId, slug: normalizedParentSlug },
      });
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

    node.title = clampText(title || normalizedSlug, 200);
    node.nodeType = nodeType;
    node.parentNodeId =
      parentNode && parentNode.id !== node.id ? parentNode.id : null;
    node.canonicalPath = parentNode
      ? `${parentNode.canonicalPath}/${normalizedSlug}`
      : normalizedSlug;
    node.summary = summary ? clampText(summary, 400) : node.summary || null;
    node.status = "active";
    node.lastCompiledAt = new Date();
    return nodeRepo.save(node);
  }

  private buildApprovedCompileResult(
    compileResult: KnowledgeCompileResult,
    approvedNodeSlugs: Set<string>,
    approvedSlugByCandidateSlug: Record<string, string>,
    parentSlugByCandidateSlug: Record<string, string | null>,
  ): KnowledgeCompileResult {
    const remapApprovedOnly = (slug: string | null | undefined): string | null => {
      const normalized = toKnowledgeSlug(slug || "");
      if (!normalized) {
        return null;
      }
      if (approvedSlugByCandidateSlug[normalized]) {
        return approvedSlugByCandidateSlug[normalized];
      }
      return approvedNodeSlugs.has(normalized) ? normalized : null;
    };

    const remappedPrimaryNodes = compileResult.primaryNodes
      .map((node) => {
        const approvedSlug = remapApprovedOnly(node.slug || node.title);
        if (!approvedSlug) {
          return null;
        }
        return {
          ...node,
          slug: approvedSlug,
          parentSlug: node.parentSlug
            ? remapApprovedOnly(node.parentSlug)
            : null,
        };
      })
      .filter((node): node is NonNullable<typeof node> => Boolean(node));

    const remappedSecondaryNodes = compileResult.secondaryNodes
      .map((node) => {
        const approvedSlug = remapApprovedOnly(node.slug || node.title);
        if (
          !approvedSlug ||
          remappedPrimaryNodes.some((primary) => primary.slug === approvedSlug)
        ) {
          return null;
        }
        return {
          ...node,
          slug: approvedSlug,
          parentSlug: node.parentSlug
            ? remapApprovedOnly(node.parentSlug)
            : null,
        };
      })
      .filter((node): node is NonNullable<typeof node> => Boolean(node));

    const fallbackPrimarySlug =
      compileResult.primaryNodes
        .map((node) => {
          const directApprovedSlug = remapApprovedOnly(node.slug || node.title);
          if (directApprovedSlug) {
            return directApprovedSlug;
          }
          return node.parentSlug ? remapApprovedOnly(node.parentSlug) : null;
        })
        .find((slug): slug is string => Boolean(slug)) ?? null;

    const primarySlug =
      remappedPrimaryNodes[0]?.slug ||
      remappedSecondaryNodes[0]?.slug ||
      fallbackPrimarySlug;

    return {
      mode: compileResult.mode,
      primaryNodes: remappedPrimaryNodes,
      secondaryNodes: remappedSecondaryNodes,
      edges: compileResult.edges
        .map((edge) => {
          const fromSlug = remapApprovedOnly(edge.fromSlug);
          const toSlug = remapApprovedOnly(edge.toSlug);
          if (!fromSlug || !toSlug || fromSlug === toSlug) {
            return null;
          }
          return {
            ...edge,
            fromSlug,
            toSlug,
          };
        })
        .filter((edge): edge is NonNullable<typeof edge> => Boolean(edge)),
      postLinks: this.dedupeApprovedPostLinks(
        compileResult.postLinks
          .map((link) => {
            const nodeSlug = remapApprovedOnly(link.nodeSlug);
            if (!nodeSlug) {
              return null;
            }
            return {
              ...link,
              nodeSlug,
            };
          })
          .filter((link): link is NonNullable<typeof link> => Boolean(link))
          .concat(
            primarySlug
              ? [
                  {
                    nodeSlug: primarySlug,
                    role: "primary" as const,
                    confidence: 0.8,
                  },
                ]
              : [],
          ),
      ),
      followups: compileResult.followups.map((followup) => ({
        ...followup,
        nodeSlug: followup.nodeSlug
          ? remapApprovedOnly(followup.nodeSlug)
          : null,
      })),
    };
  }

  private dedupeApprovedPostLinks(
    postLinks: KnowledgeCompileResult["postLinks"],
  ): KnowledgeCompileResult["postLinks"] {
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

  private mergeEvidence<T extends { postId: string }>(
    existing: T[] | undefined,
    postId: string,
    next: T,
  ) {
    const filtered = (existing || []).filter((item) => item.postId !== postId);
    filtered.push(next);
    return filtered;
  }

  private averageConfidence(values: Array<number | null | undefined>) {
    const numeric = values.filter(
      (value): value is number => typeof value === "number" && Number.isFinite(value),
    );
    if (numeric.length === 0) {
      return null;
    }
    return Number((numeric.reduce((sum, value) => sum + value, 0) / numeric.length).toFixed(4));
  }

  private flattenArtifactSections(sectionTree: KnowledgeArtifactSectionNode[]) {
    const items: ArtifactSectionIndexItem[] = [];

    const visit = (nodes: KnowledgeArtifactSectionNode[]) => {
      nodes.forEach((node) => {
        items.push({
          id: node.id,
          slug: toKnowledgeSlug(node.title),
          title: node.title,
          normalizedTitle: node.title.trim().toLowerCase(),
          summary: node.summary,
        });
        visit(node.children || []);
      });
    };

    visit(sectionTree);
    return items;
  }

  private buildNodeEvidenceRefs(
    sectionIndex: ArtifactSectionIndexItem[],
    values: Array<string | null | undefined>,
    baseRefs: string[],
  ) {
    const refs = new Set(baseRefs.filter(Boolean));
    const terms = values
      .map((value) => clampText((value || "").replace(/\s+/g, " ").trim(), 200))
      .filter(Boolean);

    const matched = sectionIndex
      .map((section) => ({
        section,
        score: this.scoreSectionMatch(section, terms),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6);

    matched.forEach((item) => refs.add(`section:${item.section.id}`));
    return Array.from(refs).slice(0, 10);
  }

  private buildEdgeEvidenceRefs(
    baseRefs: string[],
    fromSectionRefs: string[],
    toSectionRefs: string[],
  ) {
    return Array.from(
      new Set([
        ...baseRefs,
        ...fromSectionRefs,
        ...toSectionRefs,
      ].filter(Boolean)),
    ).slice(0, 10);
  }

  private scoreSectionMatch(
    section: ArtifactSectionIndexItem,
    values: string[],
  ) {
    let score = 0;

    values.forEach((value) => {
      const normalized = value.trim().toLowerCase();
      const slug = toKnowledgeSlug(value);
      if (!normalized || !slug || slug === "untitled-node") {
        return;
      }

      if (section.slug === slug) {
        score += 8;
      } else if (section.slug.includes(slug) || slug.includes(section.slug)) {
        score += 4;
      }

      if (section.normalizedTitle.includes(normalized)) {
        score += 3;
      }

      if (section.summary && section.summary.toLowerCase().includes(normalized)) {
        score += 1;
      }
    });

    return score;
  }

  private async cleanupEvidenceForPosts(
    manager: EntityManager,
    userId: string,
    blogId: string | null,
    postIds: string[],
  ) {
    const scopedPostIds = Array.from(new Set(postIds.filter(Boolean)));
    if (scopedPostIds.length === 0) {
      return;
    }

    const artifactRepo = manager.getRepository(KnowledgeSourceArtifact);
    const nodeRepo = manager.getRepository(KnowledgeCandidateNodeEntity);
    const edgeRepo = manager.getRepository(KnowledgeCandidateEdgeEntity);
    const aliasRepo = manager.getRepository(KnowledgeAliasEntity);

    await artifactRepo.delete({
      userId,
      blogId: blogId ?? IsNull(),
      postId: scopedPostIds.length === 1 ? scopedPostIds[0] : undefined,
    });
    if (scopedPostIds.length > 1) {
      await artifactRepo
        .createQueryBuilder()
        .delete()
        .where("userId = :userId", { userId })
        .andWhere(blogId ? "blogId = :blogId" : "blogId IS NULL", blogId ? { blogId } : {})
        .andWhere("postId IN (:...postIds)", { postIds: scopedPostIds })
        .execute();
    }

    const [nodes, edges] = await Promise.all([
      nodeRepo.find({
        where: {
          userId,
          blogId: blogId ?? IsNull(),
        },
      }),
      edgeRepo.find({
        where: {
          userId,
          blogId: blogId ?? IsNull(),
        },
      }),
    ]);

    for (const node of nodes) {
      const evidence = ((node.evidence || []) as unknown as CandidateNodeEvidence[]).filter(
        (item) => !scopedPostIds.includes(item.postId),
      );
      if (evidence.length === 0) {
        await aliasRepo.delete({
          userId,
          blogId: blogId ?? IsNull(),
          candidateNodeId: node.id,
        });
        await nodeRepo.delete({ id: node.id });
        continue;
      }

      node.evidence = evidence as unknown as Array<Record<string, unknown>>;
      node.postCount = new Set(evidence.map((item) => item.postId)).size;
      node.sourceCount = new Set(
        evidence.map((item) => item.sourceId || item.artifactId),
      ).size;
      node.avgConfidence = this.averageConfidence(
        evidence.map((item) => item.confidence),
      );
      if (node.status === "approved" && node.postCount === 0) {
        node.status = "provisional";
        node.canonicalNodeId = null;
      }
      await nodeRepo.save(node);
    }

    for (const edge of edges) {
      const evidence = ((edge.evidence || []) as unknown as CandidateEdgeEvidence[]).filter(
        (item) => !scopedPostIds.includes(item.postId),
      );
      if (evidence.length === 0) {
        await edgeRepo.delete({ id: edge.id });
        continue;
      }

      edge.evidence = evidence as unknown as Array<Record<string, unknown>>;
      edge.postCount = new Set(evidence.map((item) => item.postId)).size;
      edge.sourceCount = new Set(
        evidence.map((item) => item.sourceId || item.artifactId),
      ).size;
      edge.avgConfidence = this.averageConfidence(
        evidence.map((item) => item.confidence),
      );
      if (edge.status === "approved" && edge.postCount < 2) {
        edge.status = "provisional";
      }
      await edgeRepo.save(edge);
    }
  }
}
