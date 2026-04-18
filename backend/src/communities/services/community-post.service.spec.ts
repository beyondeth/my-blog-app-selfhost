import { NotFoundException } from "@nestjs/common";
import { CommunityPostStatus } from "../enums";
import { CommunityPostService } from "./community-post.service";

describe("CommunityPostService", () => {
  const createService = () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const communityRepository = {
      findOne: jest.fn(),
      increment: jest.fn(),
      decrement: jest.fn(),
    };

    const postRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      create: jest.fn((input) => input),
      save: jest.fn(async (input) => ({ id: input.id ?? "post-created", ...input })),
      findOne: jest.fn(),
    };

    const flairRepository = {
      findOne: jest.fn(),
    };

    const memberRepository = {
      findOne: jest.fn(),
    };

    const modLogRepository = {
      save: jest.fn(),
    };

    const redisLockService = {
      acquireLock: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      releaseLock: jest.fn(),
    };

    const communityPostViewService = {
      bufferView: jest.fn(),
    };

    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      deletePattern: jest.fn(),
    };

    const postContentService = {
      processContent: jest.fn(),
      extractThumbnail: jest.fn(),
    };

    const service = new CommunityPostService(
      communityRepository as any,
      postRepository as any,
      {} as any,
      memberRepository as any,
      flairRepository as any,
      modLogRepository as any,
      {} as any,
      cacheService as any,
      redisLockService as any,
      communityPostViewService as any,
      postContentService as any,
    );

    return {
      service,
      communityRepository,
      postRepository,
      queryBuilder,
      flairRepository,
      memberRepository,
      modLogRepository,
      redisLockService,
      communityPostViewService,
      cacheService,
      postContentService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("buffers community view once for new user marker", async () => {
    const {
      service,
      queryBuilder,
      redisLockService,
      communityPostViewService,
    } = createService();

    queryBuilder.getOne.mockResolvedValue({ id: "post-1" });
    redisLockService.acquireLock.mockResolvedValue("lock-1");
    redisLockService.get.mockResolvedValue(null);
    redisLockService.set.mockResolvedValue(true);

    await service.incrementPostView("community-a", "post-1", "user-1");

    expect(redisLockService.set).toHaveBeenCalledWith(
      "community:post:post-1:view:user:user-1",
      "1",
      86400,
    );
    expect(communityPostViewService.bufferView).toHaveBeenCalledWith("post-1");
    expect(redisLockService.releaseLock).toHaveBeenCalledWith(
      "community:view:lock:post-1",
      "lock-1",
    );
  });

  it("skips buffering when anonymous viewer already counted", async () => {
    const {
      service,
      queryBuilder,
      redisLockService,
      communityPostViewService,
    } = createService();

    queryBuilder.getOne.mockResolvedValue({ id: "post-2" });
    redisLockService.acquireLock.mockResolvedValue("lock-2");
    redisLockService.get.mockResolvedValue("1");

    await service.incrementPostView(
      "community-a",
      "post-2",
      undefined,
      "viewer-123",
    );

    expect(redisLockService.get).toHaveBeenCalledWith(
      "community:post:post-2:view:viewer:viewer-123",
    );
    expect(communityPostViewService.bufferView).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when post does not exist in target community", async () => {
    const { service, queryBuilder } = createService();
    queryBuilder.getOne.mockResolvedValue(null);

    await expect(
      service.incrementPostView("community-a", "missing-post", "user-1"),
    ).rejects.toThrow(NotFoundException);
  });

  it("renders html from markdown when creating a community post", async () => {
    const {
      service,
      communityRepository,
      postRepository,
      postContentService,
    } = createService();

    communityRepository.findOne.mockResolvedValue({
      id: "community-1",
      slug: "community-slug",
      isLocked: false,
    });
    postContentService.processContent.mockResolvedValue({
      html: "<h1>Title</h1><p>Body</p>",
      markdown: "# Title\n\nBody",
      isMarkdown: true,
    });

    await service.create(
      "community-1",
      {
        title: "Title",
        content: "<p>legacy html</p>",
        contentMarkdown: "# Title\n\nBody",
        isPublished: true,
      } as any,
      "author-1",
    );

    expect(postContentService.processContent).toHaveBeenCalledWith(
      "# Title\n\nBody",
      expect.objectContaining({
        forceMarkdown: true,
      }),
    );
    expect(postRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "<h1>Title</h1><p>Body</p>",
        content_markdown: "# Title\n\nBody",
        status: CommunityPostStatus.PUBLISHED,
      }),
    );
  });

  it("renders html from markdown when updating a community post", async () => {
    const { service, postRepository, postContentService } = createService();

    postRepository.findOne.mockResolvedValue({
      id: "post-1",
      authorId: "author-1",
      communityId: "community-1",
      community: { id: "community-1", slug: "community-slug" },
      content: "<p>old</p>",
      content_markdown: "old",
      status: CommunityPostStatus.PUBLISHED,
      flairId: null,
      tags: [],
      isNsfw: false,
      isSpoiler: false,
      thumbnailImageId: null,
      isPinned: false,
      isLocked: false,
    });
    postContentService.processContent.mockResolvedValue({
      html: "<p>updated</p>",
      markdown: "updated",
      isMarkdown: true,
    });

    await service.update(
      "post-1",
      {
        content: "<p>stale html</p>",
        contentMarkdown: "updated",
      } as any,
      "author-1",
    );

    expect(postContentService.processContent).toHaveBeenCalledWith(
      "updated",
      expect.objectContaining({
        forceMarkdown: true,
      }),
    );
    expect(postRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        content: "<p>updated</p>",
        content_markdown: "updated",
      }),
    );
  });
});
