import { Processor, WorkerHost } from "@nestjs/bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { Repository } from "typeorm";
import { Post } from "../../posts/entities/post.entity";
import { KnowledgeCompileRun } from "../entities/knowledge-compile-run.entity";
import { KnowledgeSource } from "../entities/knowledge-source.entity";
import { KNOWLEDGE_COMPILE_QUEUE } from "../knowledge.constants";
import {
  KnowledgeCompileJobData,
  KnowledgeCompileQueueResult,
  KnowledgeRemovePostJobData,
} from "../knowledge.types";
import { RedisLockService } from "../../redis/redis-lock.service";
import { KnowledgeSourceBuilderService } from "../services/knowledge-source-builder.service";
import { KnowledgeCandidateResolverService } from "../services/knowledge-candidate-resolver.service";
import { KnowledgeManifestService } from "../services/knowledge-manifest.service";
import { KnowledgeCompilerGatewayService } from "../services/knowledge-compiler-gateway.service";
import { KnowledgeGraphUpsertService } from "../services/knowledge-graph-upsert.service";

@Processor(KNOWLEDGE_COMPILE_QUEUE, {
  concurrency: 1,
  lockDuration: 60000,
})
export class KnowledgeCompileProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeCompileProcessor.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepository: Repository<Post>,
    @InjectRepository(KnowledgeSource)
    private readonly knowledgeSourceRepository: Repository<KnowledgeSource>,
    @InjectRepository(KnowledgeCompileRun)
    private readonly knowledgeCompileRunRepository: Repository<KnowledgeCompileRun>,
    private readonly redisLockService: RedisLockService,
    private readonly knowledgeSourceBuilderService: KnowledgeSourceBuilderService,
    private readonly knowledgeCandidateResolverService: KnowledgeCandidateResolverService,
    private readonly knowledgeManifestService: KnowledgeManifestService,
    private readonly knowledgeCompilerGatewayService: KnowledgeCompilerGatewayService,
    private readonly knowledgeGraphUpsertService: KnowledgeGraphUpsertService,
  ) {
    super();
  }

  async process(
    job: Job<KnowledgeCompileJobData | KnowledgeRemovePostJobData>,
  ): Promise<KnowledgeCompileQueueResult> {
    if (job.name === "remove-post-evidence") {
      return this.processRemovalJob(job as Job<KnowledgeRemovePostJobData>);
    }

    return this.processCompileJob(job as Job<KnowledgeCompileJobData>);
  }

  private async processCompileJob(
    job: Job<KnowledgeCompileJobData>,
  ): Promise<KnowledgeCompileQueueResult> {
    const { postId, userId } = job.data;
    return this.redisLockService.executeWithLock(
      `knowledge:user:${userId}`,
      30000,
      async () => {
        const post = await this.postRepository.findOne({
          where: { id: postId, authorId: userId },
          relations: ["metadata", "blog"],
        });

        if (!post || !post.isPublished || post.isDeleted || post.status !== "published") {
          return {
            success: true,
            postId,
            status: "skipped",
          };
        }

        const { snapshot, contentHash } =
          this.knowledgeSourceBuilderService.buildSnapshot(post, post.metadata);

        const compileRun = await this.knowledgeCompileRunRepository.save(
          this.knowledgeCompileRunRepository.create({
            userId,
            blogId: post.blogId || null,
            postId,
            postVersion: post.version || 1,
            contentHash,
            status: "processing",
            startedAt: new Date(),
          }),
        );

        const existingSource = await this.knowledgeSourceRepository.findOne({
          where: { userId, postId },
        });

        if (
          existingSource &&
          existingSource.contentHash === contentHash &&
          existingSource.status === "compiled"
        ) {
          await this.knowledgeGraphUpsertService.markCompileSkipped({
            compileRunId: compileRun.id,
            userId,
            postId,
            contentHash,
          });
          await this.knowledgeManifestService.regenerateForUser(userId);
          return {
            success: true,
            postId,
            status: "skipped",
            contentHash,
          };
        }

        try {
          const manifest = await this.knowledgeManifestService.getOrCreate(userId);
          const candidates = await this.knowledgeCandidateResolverService.resolve(
            userId,
            snapshot,
            manifest,
          );
          const compileResult =
            await this.knowledgeCompilerGatewayService.compile({
              userId,
              blogId: post.blogId || null,
              postId,
              postVersion: post.version || 1,
              source: snapshot,
              contentHash,
              manifest,
              candidates,
            });

          await this.knowledgeGraphUpsertService.syncCompiledPost({
            userId,
            blogId: post.blogId || null,
            postId,
            postVersion: post.version || 1,
            contentHash,
            snapshot,
            compileResult,
            compileRunId: compileRun.id,
          });
          await this.knowledgeManifestService.regenerateForUser(userId);

          return {
            success: true,
            postId,
            status: "compiled",
            contentHash,
          };
        } catch (error) {
          await this.knowledgeGraphUpsertService.markCompileFailed({
            compileRunId: compileRun.id,
            userId,
            postId,
            error: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
      },
    );
  }

  private async processRemovalJob(
    job: Job<KnowledgeRemovePostJobData>,
  ): Promise<KnowledgeCompileQueueResult> {
    const { userId, postId, reason } = job.data;
    await this.redisLockService.executeWithLock(
      `knowledge:user:${userId}`,
      15000,
      async () => {
        await this.knowledgeGraphUpsertService.removePostEvidence({
          userId,
          postId,
          reason,
        });
        await this.knowledgeManifestService.regenerateForUser(userId);
      },
    );

    return {
      success: true,
      postId,
      status: "compiled",
    };
  }
}
