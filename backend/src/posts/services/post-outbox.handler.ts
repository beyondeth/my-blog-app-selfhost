import { Injectable } from "@nestjs/common";
import { OnEvent, EventEmitter2 } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
  POST_PROCESSING_QUEUE,
  PostProcessingJobData,
} from "../queues/post-processing.queue";
import { PostCacheService } from "./post-cache.service";
import { CacheInvalidationEvents } from "../../common/events/cache.events";

interface PostQueueOutboxPayload {
  jobName: string;
  data: PostProcessingJobData;
  outboxEventId?: string;
  options?: {
    delay?: number;
    attempts?: number;
  };
}

interface PostCacheOutboxPayload {
  outboxEventId?: string;
  postId?: unknown;
  blogId?: unknown;
  blogSlug?: unknown;
}

@Injectable()
export class PostOutboxHandler {
  constructor(
    @InjectQueue(POST_PROCESSING_QUEUE)
    private readonly postProcessingQueue: Queue<PostProcessingJobData>,
    private readonly eventEmitter: EventEmitter2,
    private readonly postCacheService: PostCacheService,
  ) {}

  @OnEvent("outbox.post.queue", { async: true })
  async enqueuePostJob(payload: PostQueueOutboxPayload): Promise<void> {
    const { outboxEventId, options } = payload;
    await this.postProcessingQueue.add(payload.jobName, payload.data, {
      ...options,
      ...(outboxEventId ? { jobId: `outbox:${outboxEventId}` } : {}),
    });
  }

  @OnEvent("outbox.cache.posts.invalidate", { async: true })
  async invalidatePostCache(payload: PostCacheOutboxPayload): Promise<void> {
    const postId = typeof payload.postId === "string" ? payload.postId : null;
    if (!postId) {
      return;
    }

    const blogId = typeof payload.blogId === "string" ? payload.blogId : null;
    const blogSlug =
      typeof payload.blogSlug === "string" ? payload.blogSlug : blogId;

    if (blogId) {
      await this.postCacheService.invalidatePostUpdateCache(
        postId,
        blogSlug || blogId,
        blogId,
      );
      return;
    }

    await this.postCacheService.deletePostCache(postId);
  }

  @OnEvent("outbox.post.thumbnail.updated", { async: true })
  async publishThumbnailEvent(payload: Record<string, unknown>): Promise<void> {
    const { outboxEventId: _outboxEventId, ...eventPayload } = payload;
    await this.eventEmitter.emitAsync(
      CacheInvalidationEvents.POST_THUMBNAIL_UPDATED,
      eventPayload,
    );
  }

  @OnEvent("outbox.post.editor-pick.toggled", { async: true })
  async publishEditorPickEvent(
    payload: Record<string, unknown>,
  ): Promise<void> {
    const { outboxEventId: _outboxEventId, ...eventPayload } = payload;
    await this.eventEmitter.emitAsync(
      CacheInvalidationEvents.POST_EDITOR_PICK_TOGGLED,
      eventPayload,
    );
  }
}
