import { Queue } from "bullmq";
import { PostLifecycleEvents } from "../../posts/events/post-lifecycle.events";
import { KnowledgeLifecycleListener } from "./knowledge-lifecycle.listener";

describe("KnowledgeLifecycleListener", () => {
  let queue: Pick<Queue, "add">;
  let knowledgeGraphUpsertService: {
    markSourceStale: jest.Mock;
  };
  let listener: KnowledgeLifecycleListener;

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue(undefined),
    };
    knowledgeGraphUpsertService = {
      markSourceStale: jest.fn().mockResolvedValue(undefined),
    };

    listener = new KnowledgeLifecycleListener(
      queue as Queue,
      knowledgeGraphUpsertService as any,
    );
  });

  it("enqueues compile after post processing completes for published posts", async () => {
    await listener.handlePostProcessingCompleted({
      postId: "post-1",
      userId: "user-1",
      blogId: "blog-1",
      status: "published",
    });

    expect(queue.add).toHaveBeenCalledWith(
      "compile-post",
      {
        postId: "post-1",
        userId: "user-1",
        blogId: "blog-1",
      },
      expect.objectContaining({
        jobId: "knowledge:post-1:compile",
      }),
    );
  });

  it("marks source stale on non-publish-state-changing updates", async () => {
    await listener.handlePostUpdated({
      postId: "post-2",
      authorId: "user-1",
      blogId: "blog-1",
      publishStateChanged: null,
    });

    expect(knowledgeGraphUpsertService.markSourceStale).toHaveBeenCalledWith(
      "user-1",
      "post-2",
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("enqueues removal on delete and restore compile for published restores", async () => {
    await listener.handlePostDeleted({
      postId: "post-3",
      authorId: "user-1",
      blogId: "blog-1",
    });

    await listener.handlePostRestored({
      postId: "post-3",
      authorId: "user-1",
      blogId: "blog-1",
      isPublished: true,
    });

    expect(queue.add).toHaveBeenNthCalledWith(
      1,
      "remove-post-evidence",
      {
        userId: "user-1",
        postId: "post-3",
        reason: "deleted",
      },
      expect.objectContaining({
        jobId: "knowledge:post-3:remove:deleted",
      }),
    );

    expect(queue.add).toHaveBeenNthCalledWith(
      2,
      "compile-post",
      {
        postId: "post-3",
        userId: "user-1",
        blogId: "blog-1",
      },
      expect.objectContaining({
        jobId: "knowledge:post-3:restore",
      }),
    );
  });

  it("enqueues removal for unpublished transitions", async () => {
    await listener.handlePostUpdated({
      postId: "post-4",
      authorId: "user-9",
      blogId: "blog-9",
      publishStateChanged: "unpublished",
    });

    expect(queue.add).toHaveBeenCalledWith(
      "remove-post-evidence",
      {
        userId: "user-9",
        postId: "post-4",
        reason: "unpublished",
      },
      expect.objectContaining({
        jobId: "knowledge:post-4:remove:unpublished",
      }),
    );
  });
});
