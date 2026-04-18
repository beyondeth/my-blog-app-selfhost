import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KnowledgeCompileRun } from "../entities/knowledge-compile-run.entity";
import { KnowledgeFollowupSuggestion } from "../entities/knowledge-followup-suggestion.entity";
import { KnowledgeManifestCache } from "../entities/knowledge-manifest-cache.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import {
  KnowledgeManifestSnapshot,
  KnowledgeManifestTreeItem,
} from "../knowledge.types";

@Injectable()
export class KnowledgeManifestService {
  constructor(
    @InjectRepository(KnowledgeNode)
    private readonly knowledgeNodeRepository: Repository<KnowledgeNode>,
    @InjectRepository(KnowledgeCompileRun)
    private readonly knowledgeCompileRunRepository: Repository<KnowledgeCompileRun>,
    @InjectRepository(KnowledgeFollowupSuggestion)
    private readonly knowledgeFollowupRepository: Repository<KnowledgeFollowupSuggestion>,
    @InjectRepository(KnowledgeManifestCache)
    private readonly knowledgeManifestCacheRepository: Repository<KnowledgeManifestCache>,
  ) {}

  async getOrCreate(userId: string): Promise<KnowledgeManifestSnapshot> {
    const existing = await this.knowledgeManifestCacheRepository.findOne({
      where: { userId },
    });

    if (existing?.snapshot) {
      return existing.snapshot as unknown as KnowledgeManifestSnapshot;
    }

    return this.regenerateForUser(userId);
  }

  async regenerateForUser(userId: string): Promise<KnowledgeManifestSnapshot> {
    const [nodes, recentRuns, followups, existingCache] = await Promise.all([
      this.knowledgeNodeRepository.find({
        where: { userId, status: "active" },
        order: { canonicalPath: "ASC", title: "ASC" },
      }),
      this.knowledgeCompileRunRepository.find({
        where: { userId },
        order: { updatedAt: "DESC" },
        take: 10,
      }),
      this.knowledgeFollowupRepository.find({
        where: { userId, status: "pending" },
        order: { updatedAt: "DESC" },
        take: 10,
      }),
      this.knowledgeManifestCacheRepository.findOne({ where: { userId } }),
    ]);

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const treeNodeMap = new Map<string, KnowledgeManifestTreeItem>();

    for (const node of nodes) {
      treeNodeMap.set(node.id, {
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        postCount: node.postCount,
        evidenceCount: node.evidenceCount,
        children: [],
      });
    }

    const roots: KnowledgeManifestTreeItem[] = [];
    for (const node of nodes) {
      const treeItem = treeNodeMap.get(node.id)!;
      if (node.parentNodeId && treeNodeMap.has(node.parentNodeId)) {
        treeNodeMap.get(node.parentNodeId)!.children.push(treeItem);
      } else {
        roots.push(treeItem);
      }
    }

    const followupNodeIds = Array.from(
      new Set(followups.map((item) => item.nodeId).filter(Boolean)),
    ) as string[];
    const followupNodeMap = new Map(
      followupNodeIds
        .map((nodeId) => nodeById.get(nodeId))
        .filter(Boolean)
        .map((node) => [node!.id, node!]),
    );

    const snapshot: KnowledgeManifestSnapshot = {
      userId,
      version: (existingCache?.version || 0) + 1,
      generatedAt: new Date().toISOString(),
      tree: roots,
      hotNodes: nodes
        .slice()
        .sort((a, b) => {
          if (b.evidenceCount !== a.evidenceCount) {
            return b.evidenceCount - a.evidenceCount;
          }
          return b.postCount - a.postCount;
        })
        .slice(0, 10)
        .map((node) => ({
          slug: node.slug,
          title: node.title,
          canonicalPath: node.canonicalPath,
          postCount: node.postCount,
          evidenceCount: node.evidenceCount,
        })),
      recentChanges: recentRuns.map((run) => ({
        postId: run.postId,
        status: run.status,
        completedAt: run.completedAt ? run.completedAt.toISOString() : null,
        contentHash: run.contentHash,
      })),
      followups: followups.map((followup) => ({
        id: followup.id,
        title: followup.title,
        reason: followup.reason,
        status: followup.status,
        nodeSlug: followup.nodeId
          ? followupNodeMap.get(followup.nodeId)?.slug || null
          : null,
        postId: followup.postId,
      })),
    };

    const cache =
      existingCache ||
      this.knowledgeManifestCacheRepository.create({
        userId,
      });
    cache.version = snapshot.version;
    cache.snapshot = snapshot as unknown as Record<string, unknown>;
    await this.knowledgeManifestCacheRepository.save(cache);

    return snapshot;
  }
}
