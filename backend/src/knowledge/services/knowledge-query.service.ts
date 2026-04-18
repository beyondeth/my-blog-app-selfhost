import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { PostMetadata } from "../../posts/entities/post-metadata.entity";
import { KnowledgeEdge } from "../entities/knowledge-edge.entity";
import { KnowledgeFollowupSuggestion } from "../entities/knowledge-followup-suggestion.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import { KnowledgeManifestService } from "./knowledge-manifest.service";
import { PostKnowledgeLink } from "../entities/post-knowledge-link.entity";

@Injectable()
export class KnowledgeQueryService {
  constructor(
    private readonly knowledgeManifestService: KnowledgeManifestService,
    @InjectRepository(KnowledgeNode)
    private readonly knowledgeNodeRepository: Repository<KnowledgeNode>,
    @InjectRepository(KnowledgeEdge)
    private readonly knowledgeEdgeRepository: Repository<KnowledgeEdge>,
    @InjectRepository(PostKnowledgeLink)
    private readonly postKnowledgeLinkRepository: Repository<PostKnowledgeLink>,
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(PostMetadata)
    private readonly postMetadataRepository: Repository<PostMetadata>,
    @InjectRepository(KnowledgeFollowupSuggestion)
    private readonly knowledgeFollowupRepository: Repository<KnowledgeFollowupSuggestion>,
  ) {}

  async getManifest(userId: string) {
    return this.knowledgeManifestService.getOrCreate(userId);
  }

  async searchNodes(userId: string, query: string, limit = 10) {
    return this.knowledgeNodeRepository
      .createQueryBuilder("node")
      .where("node.userId = :userId", { userId })
      .andWhere("node.status = :status", { status: "active" })
      .andWhere(
        "(node.title ILIKE :query OR node.slug ILIKE :query OR node.summary ILIKE :query OR node.canonicalPath ILIKE :query)",
        {
          query: `%${query}%`,
        },
      )
      .orderBy("node.evidenceCount", "DESC")
      .addOrderBy("node.postCount", "DESC")
      .limit(Math.min(Math.max(limit, 1), 20))
      .getMany();
  }

  async readNode(userId: string, slug: string) {
    const node = await this.knowledgeNodeRepository.findOne({
      where: { userId, slug },
    });
    if (!node) {
      throw new NotFoundException("Knowledge node not found");
    }

    const [links, edges] = await Promise.all([
      this.postKnowledgeLinkRepository.find({
        where: { userId, nodeId: node.id },
        order: { updatedAt: "DESC" },
      }),
      this.knowledgeEdgeRepository.find({
        where: [{ userId, fromNodeId: node.id }, { userId, toNodeId: node.id }],
        order: { updatedAt: "DESC" },
      }),
    ]);

    const posts = links.length
      ? await this.postRepository.find({
          where: links.map((link) => ({ id: link.postId })),
          relations: ["blog"],
        })
      : [];
    const metadata = posts.length
      ? await this.postMetadataRepository.find({
          where: posts.map((post) => ({ postId: post.id })),
        })
      : [];
    const metadataMap = new Map(metadata.map((item) => [item.postId, item]));

    return {
      node,
      posts: posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        blogSlug: post.blog?.slug || null,
        category: metadataMap.get(post.id)?.category || null,
        excerpt: metadataMap.get(post.id)?.excerpt || null,
        isPublished: post.isPublished,
        visibility: post.visibility,
      })),
      edges,
    };
  }

  async listFollowups(userId: string, status?: string) {
    const where = status
      ? { userId, status: status as any }
      : { userId };
    return this.knowledgeFollowupRepository.find({
      where,
      order: { updatedAt: "DESC" },
      take: 30,
    });
  }

  async dismissFollowup(userId: string, suggestionId: string) {
    const suggestion = await this.knowledgeFollowupRepository.findOne({
      where: { id: suggestionId, userId },
    });
    if (!suggestion) {
      throw new NotFoundException("Follow-up suggestion not found");
    }

    suggestion.status = "dismissed";
    suggestion.dismissedAt = new Date();
    return this.knowledgeFollowupRepository.save(suggestion);
  }
}
