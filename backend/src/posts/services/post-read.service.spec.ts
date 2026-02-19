import { CacheKeys } from "../../cache/cache.service";
import { PostReadService } from "./post-read.service";

describe("PostReadService", () => {
  const createService = () => {
    const postsRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const postMapperService = {
      toPostDto: jest.fn(),
    };
    const postInteractionStatusService = {
      getMultipleInteractionStatuses: jest.fn(),
    };
    const cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      acquireLock: jest.fn(),
      waitForLock: jest.fn(),
      releaseLock: jest.fn(),
    };

    const service = new PostReadService(
      postsRepository as any,
      {} as any,
      {} as any,
      postMapperService as any,
      {} as any,
      postInteractionStatusService as any,
      cacheService as any,
      {} as any,
    );

    return {
      service,
      postsRepository,
      postMapperService,
      postInteractionStatusService,
      cacheService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("resolves slug via cache mapping and applies user interaction overlay", async () => {
    const {
      service,
      cacheService,
      postsRepository,
      postInteractionStatusService,
    } = createService();

    cacheService.get
      .mockResolvedValueOnce("post-1")
      .mockResolvedValueOnce({
        id: "post-1",
        slug: "hello-world",
        title: "Hello",
        liked: false,
        bookmarked: false,
        userVote: null,
      });

    const interactionMap = new Map<string, any>([
      [
        "post-1",
        { liked: true, bookmarked: true, userVote: "upvote" },
      ],
    ]);
    postInteractionStatusService.getMultipleInteractionStatuses.mockResolvedValue(
      interactionMap,
    );

    const result = await service.findBySlug("hello-world", {
      id: "user-1",
    } as any);

    expect(postsRepository.findOne).not.toHaveBeenCalled();
    expect(result.liked).toBe(true);
    expect(result.bookmarked).toBe(true);
    expect(result.userVote).toBe("upvote");
  });

  it("loads from repository on slug cache miss and stores id/detail caches", async () => {
    const { service, cacheService, postsRepository, postMapperService } =
      createService();

    cacheService.get.mockResolvedValue(null);
    cacheService.acquireLock.mockResolvedValue(true);

    const postEntity = {
      id: "post-22",
      slug: "cache-me",
      title: "Cache me",
      isPublished: true,
      authorId: "author-1",
      author: { id: "author-1", username: "author" },
      blog: { id: "blog-1", userId: "author-1", slug: "blog-1", name: "Blog" },
    };
    postsRepository.findOne.mockResolvedValue(postEntity);
    postMapperService.toPostDto.mockResolvedValue({
      id: "post-22",
      slug: "cache-me",
      title: "Cache me",
      liked: false,
      bookmarked: false,
      userVote: null,
    });

    const result = await service.findBySlug("cache-me");

    expect(postsRepository.findOne).toHaveBeenCalled();
    expect(cacheService.set).toHaveBeenCalledWith(
      CacheKeys.POST_CORE("post-22"),
      expect.objectContaining({ id: "post-22", slug: "cache-me" }),
      30,
    );
    expect(cacheService.set).toHaveBeenCalledWith(
      CacheKeys.POST_BY_SLUG("cache-me"),
      "post-22",
      30,
    );
    expect(cacheService.releaseLock).toHaveBeenCalledWith(
      "post:detail:lock:slug:cache-me",
    );
    expect(result.id).toBe("post-22");
  });

  it("returns findById from cache without querying database", async () => {
    const { service, cacheService, postsRepository } = createService();

    cacheService.get.mockResolvedValue({
      id: "post-9",
      slug: "cached-id",
      title: "Cached by id",
      liked: false,
      bookmarked: false,
      userVote: null,
    });

    const result = await service.findById("post-9", ["author", "blog"]);

    expect(postsRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(result.id).toBe("post-9");
  });
});
