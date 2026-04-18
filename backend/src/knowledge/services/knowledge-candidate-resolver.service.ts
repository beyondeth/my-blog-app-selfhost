import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { KnowledgeCandidateNodeEntity } from "../entities/knowledge-candidate-node.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import {
  KnowledgeCandidateNode,
  KnowledgeManifestSnapshot,
  KnowledgeSourceSnapshot,
} from "../knowledge.types";
import { getKnowledgeSignalTerms } from "../utils/knowledge-signal.util";
import { resolveKnowledgeSourceTaxonomy } from "../utils/knowledge-taxonomy.util";
import { toKnowledgeSlug } from "../utils/knowledge-slug.util";

@Injectable()
export class KnowledgeCandidateResolverService {
  constructor(
    @InjectRepository(KnowledgeNode)
    private readonly knowledgeNodeRepository: Repository<KnowledgeNode>,
    @InjectRepository(KnowledgeCandidateNodeEntity)
    private readonly knowledgeCandidateNodeRepository: Repository<KnowledgeCandidateNodeEntity>,
  ) {}

  async resolve(
    userId: string,
    source: KnowledgeSourceSnapshot,
    manifest: KnowledgeManifestSnapshot | null,
  ): Promise<KnowledgeCandidateNode[]> {
    const { signalTags, queryTokens } = getKnowledgeSignalTerms(source);
    const taxonomy = resolveKnowledgeSourceTaxonomy(source);
    const slugs = new Set<string>();
    taxonomy.signalSlugs.forEach((slug) => slugs.add(slug));
    signalTags.forEach((tag) => slugs.add(toKnowledgeSlug(tag)));

    const hotSlugs = manifest?.hotNodes?.slice(0, 6).map((item) => item.slug) || [];
    hotSlugs.forEach((slug) => slugs.add(slug));

    const qb = this.knowledgeNodeRepository
      .createQueryBuilder("node")
      .where("node.userId = :userId", { userId })
      .andWhere("node.status = :status", { status: "active" });
    const candidateQb = this.knowledgeCandidateNodeRepository
      .createQueryBuilder("candidate")
      .where("candidate.userId = :userId", { userId })
      .andWhere("candidate.status IN (:...candidateStatuses)", {
        candidateStatuses: ["provisional", "approved"],
      });

    if (slugs.size > 0 || queryTokens.length > 0) {
      const clauses: string[] = [];
      const params: Record<string, unknown> = { userId, status: "active" };

      if (slugs.size > 0) {
        clauses.push("node.slug IN (:...slugs)");
        params.slugs = Array.from(slugs);
      }

      queryTokens.forEach((token, index) => {
        clauses.push(
          `(node.title ILIKE :token${index} OR node.summary ILIKE :token${index} OR node.canonicalPath ILIKE :token${index})`,
        );
        params[`token${index}`] = `%${token}%`;
      });

      qb.andWhere(clauses.map((clause) => `(${clause})`).join(" OR "), params);
      const candidateClauses = clauses.map((clause) =>
        clause
          .replace(/node\.slug/g, "candidate.slug")
          .replace(/node\.title/g, "candidate.title")
          .replace(/node\.summary/g, "candidate.summary")
          .replace(/node\.canonicalPath/g, "candidate.slug"),
      );
      candidateQb.andWhere(
        candidateClauses.map((clause) => `(${clause})`).join(" OR "),
        params,
      );
    }

    const [nodes, provisionalNodes] = await Promise.all([
      qb
        .orderBy("node.evidenceCount", "DESC")
        .addOrderBy("node.postCount", "DESC")
        .addOrderBy("node.updatedAt", "DESC")
        .limit(12)
        .getMany(),
      candidateQb
        .orderBy("candidate.postCount", "DESC")
        .addOrderBy("candidate.updatedAt", "DESC")
        .limit(12)
        .getMany(),
    ]);

    const merged = [
      ...nodes.map((node) => ({
        id: node.id,
        slug: node.slug,
        title: node.title,
        canonicalPath: node.canonicalPath,
        summary: node.summary,
        nodeType: node.nodeType,
        parentNodeId: node.parentNodeId,
        evidenceCount: node.evidenceCount,
        postCount: node.postCount,
      })),
      ...provisionalNodes.map((node) => ({
        id: node.id,
        slug: node.slug,
        title: node.title,
        canonicalPath: node.proposedParentSlug
          ? `${node.proposedParentSlug}/${node.slug}`
          : node.slug,
        summary: node.summary,
        nodeType: node.nodeType,
        parentNodeId: null,
        evidenceCount: node.sourceCount,
        postCount: node.postCount,
      })),
    ];

    const unique = new Map<string, KnowledgeCandidateNode>();
    for (const node of merged) {
      if (!unique.has(node.slug)) {
        unique.set(node.slug, node);
      }
    }

    return Array.from(unique.values()).slice(0, 12).map((node) => ({
      id: node.id,
      slug: node.slug,
      title: node.title,
      canonicalPath: node.canonicalPath,
      summary: node.summary,
      nodeType: node.nodeType,
      parentNodeId: node.parentNodeId,
      evidenceCount: node.evidenceCount,
      postCount: node.postCount,
    }));
  }
}
