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
    const postsReadRepository = {
      findByIdWithRelations: jest.fn(),
      findBySlugWithRelations: jest.fn(),
      getCursorPaginatedQueryBuilder: jest.fn(),
    };

    const service = new PostReadService(
      postsRepository as any,
      {} as any,
      {} as any,
      postsReadRepository as any,
      postMapperService as any,
      {} as any,
      postInteractionStatusService as any,
      cacheService as any,
      {} as any,
    );

    return {
      service,
      postsRepository,
      postsReadRepository,
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
      postsReadRepository,
      postInteractionStatusService,
    } = createService();

    cacheService.get.mockResolvedValueOnce("post-1").mockResolvedValueOnce({
      id: "post-1",
      slug: "hello-world",
      title: "Hello",
      liked: false,
      bookmarked: false,
      userVote: null,
    });

    const interactionMap = new Map<string, any>([
      ["post-1", { liked: true, bookmarked: true, userVote: "upvote" }],
    ]);
    postInteractionStatusService.getMultipleInteractionStatuses.mockResolvedValue(
      interactionMap,
    );

    const result = await service.findBySlug("hello-world", {
      id: "user-1",
    } as any);

    expect(postsReadRepository.findBySlugWithRelations).not.toHaveBeenCalled();
    expect(result.liked).toBe(true);
    expect(result.bookmarked).toBe(true);
    expect(result.userVote).toBe("upvote");
  });

  it("loads from repository on slug cache miss and stores id/detail caches", async () => {
    const { service, cacheService, postsReadRepository, postMapperService } =
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
    postsReadRepository.findBySlugWithRelations.mockResolvedValue(postEntity);
    postMapperService.toPostDto.mockResolvedValue({
      id: "post-22",
      slug: "cache-me",
      title: "Cache me",
      liked: false,
      bookmarked: false,
      userVote: null,
    });

    const result = await service.findBySlug("cache-me");

    expect(postsReadRepository.findBySlugWithRelations).toHaveBeenCalled();
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
    const { service, cacheService, postsReadRepository } = createService();

    cacheService.get.mockResolvedValue({
      id: "post-9",
      slug: "cached-id",
      title: "Cached by id",
      liked: false,
      bookmarked: false,
      userVote: null,
    });

    const result = await service.findById("post-9", ["author", "blog"]);

    expect(postsReadRepository.findByIdWithRelations).not.toHaveBeenCalled();
    expect(result.id).toBe("post-9");
  });

  it("applies popular sort to cursor query when sort is popular", async () => {
    const { service, postsReadRepository } = createService();
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    postsReadRepository.getCursorPaginatedQueryBuilder.mockReturnValue(
      queryBuilder,
    );

    const result = await service.getPostsCursor({
      sort: "popular",
      limit: 20,
    } as any);

    expect(queryBuilder.orderBy).toHaveBeenCalledWith("post.likeCount", "DESC");
    expect(queryBuilder.limit).toHaveBeenCalledWith(21);
    expect(result.posts).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(result.count).toBe(0);
  });

  it("orders by search rank when searching with recent sort", async () => {
    const { service, postsReadRepository } = createService();
    const queryBuilder = {
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    postsReadRepository.getCursorPaginatedQueryBuilder.mockReturnValue(
      queryBuilder,
    );

    await service.getPostsCursor({
      sortBy: "recent",
      search: "react hooks",
      limit: 20,
    } as any);

    expect(queryBuilder.addSelect).toHaveBeenCalled();
    expect(queryBuilder.orderBy).toHaveBeenCalledWith("search_rank", "DESC");
    expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
      "post.publishedAt",
      "DESC",
    );
  });
});
