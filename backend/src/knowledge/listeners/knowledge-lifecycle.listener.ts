import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { PostLifecycleEvents, PostLifecyclePayload } from "../../posts/events/post-lifecycle.events";
import { KNOWLEDGE_COMPILE_QUEUE, KnowledgeEvents } from "../knowledge.constants";
import {
  KnowledgeCompileJobData,
  KnowledgeRemovePostJobData,
  PostProcessingCompletedEvent,
} from "../knowledge.types";
import { KnowledgeGraphUpsertService } from "../services/knowledge-graph-upsert.service";

@Injectable()
export class KnowledgeLifecycleListener {
  private readonly logger = new Logger(KnowledgeLifecycleListener.name);

  constructor(
    @InjectQueue(KNOWLEDGE_COMPILE_QUEUE)
    private readonly knowledgeCompileQueue: Queue<
      KnowledgeCompileJobData | KnowledgeRemovePostJobData
    >,
    private readonly knowledgeGraphUpsertService: KnowledgeGraphUpsertService,
  ) {}

  @OnEvent(KnowledgeEvents.POST_PROCESSING_COMPLETED, { async: true })
  async handlePostProcessingCompleted(
    payload: PostProcessingCompletedEvent,
  ): Promise<void> {
    if (payload.status !== "published" || !payload.userId || !payload.postId) {
      return;
    }

    try {
      await this.knowledgeCompileQueue.add(
        "compile-post",
        {
          postId: payload.postId,
          userId: payload.userId,
          blogId: payload.blogId || null,
        },
        {
          jobId: `knowledge:${payload.postId}:compile`,
          delay: 500,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue knowledge compile for ${payload.postId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  @OnEvent(PostLifecycleEvents.UPDATED, { async: true })
  async handlePostUpdated(payload: PostLifecyclePayload): Promise<void> {
    if (!payload.authorId || !payload.postId) {
      return;
    }

    if (payload.publishStateChanged === "unpublished") {
      await this.enqueueRemoval(payload.authorId, payload.postId, "unpublished");
      return;
    }

    if (payload.publishStateChanged === null) {
      await this.knowledgeGraphUpsertService.markSourceStale(
        payload.authorId,
        payload.postId,
      );
    }
  }

  @OnEvent(PostLifecycleEvents.DELETED, { async: true })
  async handlePostDeleted(payload: PostLifecyclePayload): Promise<void> {
    if (!payload.authorId || !payload.postId) {
      return;
    }

    await this.enqueueRemoval(payload.authorId, payload.postId, "deleted");
  }

  @OnEvent(PostLifecycleEvents.RESTORED, { async: true })
  async handlePostRestored(payload: PostLifecyclePayload): Promise<void> {
    if (!payload.isPublished || !payload.authorId || !payload.postId) {
      return;
    }

    await this.knowledgeCompileQueue.add(
      "compile-post",
      {
        postId: payload.postId,
        userId: payload.authorId,
        blogId: payload.blogId || null,
      },
      {
        jobId: `knowledge:${payload.postId}:restore`,
        delay: 500,
      },
    );
  }

  private async enqueueRemoval(
    userId: string,
    postId: string,
    reason: "unpublished" | "deleted",
  ) {
    try {
      await this.knowledgeCompileQueue.add(
        "remove-post-evidence",
        {
          userId,
          postId,
          reason,
        },
        {
          jobId: `knowledge:${postId}:remove:${reason}`,
          delay: 100,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to enqueue knowledge removal for ${postId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
