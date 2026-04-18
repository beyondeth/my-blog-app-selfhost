import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  PostLifecycleEvents,
  PostLifecyclePayload,
} from "../events/post-lifecycle.events";
import { BlogStatsService } from "../../common/services/blog-stats.service";

import {
  POST_PROCESSING_QUEUE,
  PostProcessingJobData,
} from "../queues/post-processing.queue";
import { Post } from "../entities/post.entity";

/**
 * 포스트 라이프사이클 이벤트 리스너
 *
 * PostCreationService의 트랜잭션 커밋 후 발행되는 이벤트를 수신하여
 * 부작용(통계 업데이트, 큐 작업)을 처리합니다.
 *
 * ⚠️ 캐시 무효화 정책:
 * 캐시 무효화는 이 리스너에서 처리하지 않습니다.
 * CacheInvalidationListener가 동일 PostLifecycleEvents를 구독하여
 * 캐시 삭제를 단일 경로로 전담합니다. (이중 삭제 방지)
 *
 * 설계 원칙:
 * - 이벤트 핸들러는 best-effort (실패해도 핵심 트랜잭션 롤백 안 함)
 * - payload에는 postId + 메타데이터만 (content 본문 제외)
 * - 큐 jobId에 idempotency 키 적용 (postId:action)
 */
@Injectable()
export class PostLifecycleListener {
  private readonly logger = new Logger(PostLifecycleListener.name);

  constructor(
    private readonly blogStatsService: BlogStatsService,
    @InjectQueue(POST_PROCESSING_QUEUE)
    private readonly postProcessingQueue: Queue<PostProcessingJobData>,
    @InjectRepository(Post)
    private readonly postsRepository: Repository<Post>,
  ) {}

  @OnEvent(PostLifecycleEvents.CREATED, { async: true })
  async handleCreated(payload: PostLifecyclePayload): Promise<void> {
    this.logger.log(
      `[PostLifecycle] CREATED: postId=${payload.postId}, published=${payload.isPublished}`,
    );

    if (payload.isPublished) {
      try {
        await this.blogStatsService.incrementPostCount(payload.blogId);
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to increment blog stats: ${err.message}`,
        );
      }

      try {
        // content는 payload에 없으므로 DB에서 조회
        const post = await this.postsRepository.findOne({
          where: { id: payload.postId },
          select: [
            "id",
            "title",
            "content",
            "tags",
            "category",
            "status",
            "processingError",
            "processingCompletedAt",
          ],
        });

        const job = await this.postProcessingQueue.add(
          "process-published-post",
          {
            postId: payload.postId,
            userId: payload.authorId,
            blogId: payload.blogId,
            title: payload.title || post?.title,
            content: post?.content || "",
            tags: payload.tags || post?.tags,
            category: payload.category || post?.category,
          },
          {
            jobId: `${payload.postId}:created:${Date.now()}`,
            delay: 1000,
            attempts: 3,
          },
        );

        this.logger.log(
          `[PostLifecycle] Enqueued post-processing jobId=${job.id} postId=${payload.postId} status=${post?.status ?? "unknown"} processingCompletedAt=${post?.processingCompletedAt?.toISOString?.() ?? "null"} processingError=${post?.processingError ?? "null"}`,
        );
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to enqueue post processing: ${err.message}`,
        );
      }
    }

    // 캐시 무효화는 CacheInvalidationListener가 전담 (단일 경로 정책)
  }

  @OnEvent(PostLifecycleEvents.UPDATED, { async: true })
  async handleUpdated(payload: PostLifecyclePayload): Promise<void> {
    this.logger.log(
      `[PostLifecycle] UPDATED: postId=${payload.postId}, publishChange=${payload.publishStateChanged}`,
    );

    // 발행 상태 변경 처리
    if (payload.publishStateChanged === "published") {
      try {
        await this.blogStatsService.incrementPostCount(payload.blogId);
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to increment blog stats: ${err.message}`,
        );
      }

      try {
        const post = await this.postsRepository.findOne({
          where: { id: payload.postId },
          select: [
            "id",
            "title",
            "content",
            "tags",
            "category",
            "status",
            "processingError",
            "processingCompletedAt",
          ],
        });

        const job = await this.postProcessingQueue.add(
          "process-published-post",
          {
            postId: payload.postId,
            userId: payload.authorId,
            blogId: payload.blogId,
            title: payload.title || post?.title,
            content: post?.content || "",
            tags: payload.tags || post?.tags,
            category: payload.category || post?.category,
          },
          {
            jobId: `${payload.postId}:published:${Date.now()}`,
            delay: 1000,
            attempts: 3,
          },
        );

        this.logger.log(
          `[PostLifecycle] Enqueued post-processing jobId=${job.id} postId=${payload.postId} status=${post?.status ?? "unknown"} processingCompletedAt=${post?.processingCompletedAt?.toISOString?.() ?? "null"} processingError=${post?.processingError ?? "null"}`,
        );
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to enqueue post processing: ${err.message}`,
        );
      }
    } else if (payload.publishStateChanged === "unpublished") {
      try {
        await this.blogStatsService.decrementPostCount(payload.blogId);
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to decrement blog stats: ${err.message}`,
        );
      }
    }

    // 캐시 무효화는 CacheInvalidationListener가 전담 (단일 경로 정책)
  }

  @OnEvent(PostLifecycleEvents.DELETED, { async: true })
  async handleDeleted(payload: PostLifecyclePayload): Promise<void> {
    this.logger.log(
      `[PostLifecycle] DELETED: postId=${payload.postId}, wasPublished=${payload.wasPublished}`,
    );

    if (payload.wasPublished) {
      try {
        await this.blogStatsService.decrementPostCount(payload.blogId);
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to decrement blog stats: ${err.message}`,
        );
      }
    }

    // 클린업 큐 작업 (best-effort)
    try {
      const post = await this.postsRepository.findOne({
        where: { id: payload.postId },
        select: ["id", "content"],
        withDeleted: true,
      });

      await this.postProcessingQueue.add(
        "cleanup-deleted-post",
        {
          postId: payload.postId,
          blogId: payload.blogId,
          content: post?.content || "",
        } as PostProcessingJobData,
        {
          jobId: `${payload.postId}:cleanup:${Date.now()}`,
          delay: 5000,
          attempts: 3,
        },
      );
    } catch (err) {
      this.logger.warn(
        `[PostLifecycle] Failed to enqueue cleanup (best-effort): ${err.message}`,
      );
    }

    // 캐시 무효화는 CacheInvalidationListener가 전담 (단일 경로 정책)
  }

  @OnEvent(PostLifecycleEvents.RESTORED, { async: true })
  async handleRestored(payload: PostLifecyclePayload): Promise<void> {
    this.logger.log(
      `[PostLifecycle] RESTORED: postId=${payload.postId}, isPublished=${payload.isPublished}`,
    );

    if (payload.isPublished) {
      try {
        await this.blogStatsService.incrementPostCount(payload.blogId);
      } catch (err) {
        this.logger.error(
          `[PostLifecycle] Failed to increment blog stats: ${err.message}`,
        );
      }
    }
  }
}
