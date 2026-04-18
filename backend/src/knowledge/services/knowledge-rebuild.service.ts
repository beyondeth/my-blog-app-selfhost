import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { RedisLockService } from "../../redis/redis-lock.service";
import { KnowledgeCompileRun } from "../entities/knowledge-compile-run.entity";
import { KnowledgeCandidateResolverService } from "./knowledge-candidate-resolver.service";
import { KnowledgeCompilerGatewayService } from "./knowledge-compiler-gateway.service";
import { KnowledgeGraphUpsertService } from "./knowledge-graph-upsert.service";
import { KnowledgeManifestService } from "./knowledge-manifest.service";
import { KnowledgeSourceBuilderService } from "./knowledge-source-builder.service";

export interface KnowledgeBlogRef {
  id: string;
  userId: string;
}

export interface KnowledgeRebuildFailure {
  postId: string;
  title: string;
  error: string;
}

export interface KnowledgeRebuildResult {
  blogId: string;
  userId: string;
  totalBlogPosts: number;
  publishedPosts: number;
  compiledPosts: number;
  failedPosts: number;
  failures: KnowledgeRebuildFailure[];
}

@Injectable()
export class KnowledgeRebuildService {
  private readonly logger = new Logger(KnowledgeRebuildService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(KnowledgeCompileRun)
    private readonly knowledgeCompileRunRepository: Repository<KnowledgeCompileRun>,
    private readonly redisLockService: RedisLockService,
    private readonly knowledgeSourceBuilderService: KnowledgeSourceBuilderService,
    private readonly knowledgeCandidateResolverService: KnowledgeCandidateResolverService,
    private readonly knowledgeManifestService: KnowledgeManifestService,
    private readonly knowledgeCompilerGatewayService: KnowledgeCompilerGatewayService,
    private readonly knowledgeGraphUpsertService: KnowledgeGraphUpsertService,
  ) {}

  async rebuildBlog(blog: KnowledgeBlogRef): Promise<KnowledgeRebuildResult> {
    return this.redisLockService.executeWithLock(
      `knowledge:user:${blog.userId}`,
      120000,
      async () => {
        const [allBlogPosts, publishedPosts] = await Promise.all([
          this.postRepository.find({
            where: {
              blogId: blog.id,
              authorId: blog.userId,
            },
          }),
          this.postRepository.find({
            where: {
              blogId: blog.id,
              authorId: blog.userId,
              isDeleted: false,
              isPublished: true,
              status: "published",
            },
            relations: ["metadata", "blog"],
            order: {
              createdAt: "ASC",
            },
          }),
        ]);

        await this.knowledgeGraphUpsertService.resetBlogKnowledgeGraph({
          userId: blog.userId,
          blogId: blog.id,
          postIds: allBlogPosts.map((post) => post.id),
        });
        await this.knowledgeManifestService.regenerateForUser(blog.userId);

        const result: KnowledgeRebuildResult = {
          blogId: blog.id,
          userId: blog.userId,
          totalBlogPosts: allBlogPosts.length,
          publishedPosts: publishedPosts.length,
          compiledPosts: 0,
          failedPosts: 0,
          failures: [],
        };

        for (const post of publishedPosts) {
          const { snapshot, contentHash } =
            this.knowledgeSourceBuilderService.buildSnapshot(post, post.metadata);

          const compileRun = await this.knowledgeCompileRunRepository.save(
            this.knowledgeCompileRunRepository.create({
              userId: blog.userId,
              blogId: blog.id,
              postId: post.id,
              postVersion: post.version || 1,
              contentHash,
              status: "processing",
              startedAt: new Date(),
            }),
          );

          try {
            const manifest = await this.knowledgeManifestService.getOrCreate(
              blog.userId,
            );
            const candidates =
              await this.knowledgeCandidateResolverService.resolve(
                blog.userId,
                snapshot,
                manifest,
              );
            const compileResult =
              await this.knowledgeCompilerGatewayService.compile({
                userId: blog.userId,
                blogId: blog.id,
                postId: post.id,
                postVersion: post.version || 1,
                source: snapshot,
                contentHash,
                manifest,
                candidates,
              });

            await this.knowledgeGraphUpsertService.syncCompiledPost({
              userId: blog.userId,
              blogId: blog.id,
              postId: post.id,
              postVersion: post.version || 1,
              contentHash,
              snapshot,
              compileResult,
              compileRunId: compileRun.id,
            });
            await this.knowledgeManifestService.regenerateForUser(blog.userId);
            result.compiledPosts += 1;
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            this.logger.warn(
              `Failed to rebuild knowledge for post ${post.id}: ${message}`,
            );
            await this.knowledgeGraphUpsertService.markCompileFailed({
              compileRunId: compileRun.id,
              userId: blog.userId,
              postId: post.id,
              error: message,
            });
            result.failedPosts += 1;
            result.failures.push({
              postId: post.id,
              title: post.title || "Untitled post",
              error: message,
            });
          }
        }

        await this.knowledgeManifestService.regenerateForUser(blog.userId);
        return result;
      },
    );
  }
}
