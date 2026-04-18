import { EventEmitter2 } from "@nestjs/event-emitter";
import { Repository } from "typeorm";
import { Post } from "../entities/post.entity";
import { PostMetadata } from "../entities/post-metadata.entity";
import { File } from "../../files/entities/file.entity";
import { FileContext } from "../../files/entities/file-context.entity";
import { MarkdownRendererService } from "../../common/services/markdown-renderer.service";
import { ContentProcessingService } from "../../content-processing/services/content-processing.service";
import { VideoCleanupService } from "../../files/services/video-cleanup.service";
import { VideoLifecycleService } from "../../files/services/video-lifecycle.service";
import { PostMetadataSyncService } from "../services/post-metadata-sync.service";
import { PostProcessingProcessor } from "./post-processing.processor";
import { KnowledgeEvents } from "../../knowledge/knowledge.constants";

type MockRepo<T> = Partial<Record<keyof Repository<T>, jest.Mock>>;

describe("PostProcessingProcessor", () => {
  let postRepository: MockRepo<Post>;
  let postMetadataRepository: MockRepo<PostMetadata>;
  let fileRepository: MockRepo<File>;
  let fileContextRepository: MockRepo<FileContext>;
  let markdownRenderer: jest.Mocked<MarkdownRendererService>;
  let contentProcessing: jest.Mocked<ContentProcessingService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let videoCleanupService: jest.Mocked<VideoCleanupService>;
  let videoLifecycleService: jest.Mocked<VideoLifecycleService>;
  let postMetadataSyncService: jest.Mocked<PostMetadataSyncService>;
  let processor: PostProcessingProcessor;

  beforeEach(() => {
    postRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    postMetadataRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };
    fileRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      find: jest.fn(),
    };
    fileContextRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      create: jest.fn((value) => value),
    };
    markdownRenderer = {
      convertToHtml: jest.fn(),
    } as unknown as jest.Mocked<MarkdownRendererService>;
    contentProcessing = {
      process: jest.fn(),
    } as unknown as jest.Mocked<ContentProcessingService>;
    eventEmitter = {
      emit: jest.fn(),
      removeAllListeners: jest.fn(),
    } as unknown as jest.Mocked<EventEmitter2>;
    videoCleanupService = {
      handlePostDeletion: jest.fn(),
    } as unknown as jest.Mocked<VideoCleanupService>;
    videoLifecycleService = {
      markVideosAsPermanent: jest.fn().mockResolvedValue(0),
    } as unknown as jest.Mocked<VideoLifecycleService>;
    postMetadataSyncService = {
      syncShadowFromPost: jest.fn((post, metadata) => ({
        ...metadata,
        postId: post.id,
      })),
    } as unknown as jest.Mocked<PostMetadataSyncService>;

    processor = new PostProcessingProcessor(
      postRepository as unknown as Repository<Post>,
      postMetadataRepository as unknown as Repository<PostMetadata>,
      fileRepository as unknown as Repository<File>,
      fileContextRepository as unknown as Repository<FileContext>,
      markdownRenderer,
      contentProcessing,
      eventEmitter,
      videoCleanupService,
      videoLifecycleService,
      postMetadataSyncService,
    );
  });

  it("processes fast-path published posts and emits knowledge compile trigger", async () => {
    const post = {
      id: "post-1",
      status: "published",
      content_type: "html",
      content: "<p>raw</p>",
      content_markdown: null,
      excerpt: "",
      processingCompletedAt: null,
      processingError: null,
    } as Post;
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: "post-1",
        blog: { slug: "demo-blog", userId: "user-1" },
      }),
    };

    (postRepository.findOne as jest.Mock)
      .mockResolvedValueOnce(post)
      .mockResolvedValueOnce(null);
    (postRepository.createQueryBuilder as jest.Mock).mockReturnValue(
      queryBuilder,
    );
    (postMetadataRepository.findOne as jest.Mock).mockResolvedValue(null);
    (contentProcessing.process as jest.Mock).mockResolvedValue({
      html: "<p>processed</p>",
      metadata: {},
    });
    (postRepository.save as jest.Mock).mockImplementation(async (value) => value);
    (postMetadataRepository.save as jest.Mock).mockImplementation(
      async (value) => value,
    );

    const result = await processor.process({
      name: "process-published-post",
      data: {
        postId: "post-1",
        userId: "user-1",
        blogId: "blog-1",
        content: "<p>raw</p>",
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any);

    expect(result.success).toBe(true);
    expect(result.status).toBe("published");
    expect(contentProcessing.process).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      KnowledgeEvents.POST_PROCESSING_COMPLETED,
      expect.objectContaining({
        postId: "post-1",
        blogId: "blog-1",
        userId: "user-1",
        status: "published",
      }),
    );
  });

  it("returns a failed result for invalid statuses", async () => {
    (postRepository.findOne as jest.Mock).mockResolvedValue({
      id: "post-2",
      status: "draft",
      content_type: "html",
      content: "<p>draft</p>",
      content_markdown: null,
      excerpt: "",
      processingCompletedAt: null,
      processingError: null,
    } as Post);

    const result = await processor.process({
      name: "process-published-post",
      data: {
        postId: "post-2",
        userId: "user-1",
        blogId: "blog-1",
        content: "<p>draft</p>",
      },
      attemptsMade: 0,
      opts: { attempts: 3 },
    } as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid status: draft");
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
