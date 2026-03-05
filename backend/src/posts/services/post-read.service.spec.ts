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
    const postAccessPolicyService = {
      PRIVATE_VISIBILITY: "private",
      PUBLIC_VISIBILITY: "public",
      normalizeVisibility: jest.fn((value?: string | null) =>
        value === "private" ? "private" : "public",
      ),
      isOwnerOrAdmin: jest.fn((user: any, subject: any) => {
        if (!user?.id) return false;
        if (user.role === "admin") return true;
        return user.id === subject.authorId || user.id === subject.blogOwnerId;
      }),
      isPubliclyReadablePost: jest.fn((post: any, blog: any) => {
        return (
          post?.isPublished !== false &&
          post?.isDeleted !== true &&
          (post?.visibility ?? "public") !== "private" &&
          blog?.isPublic !== false
        );
      }),
      getPublicVisibilityQueryValue: jest.fn(() => "public"),
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
      postAccessPolicyService as any,
      {} as any,
    );

    return {
      service,
      postsRepository,
      postsReadRepository,
      postMapperService,
      postInteractionStatusService,
      cacheService,
      postAccessPolicyService,
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
      blog: {
        id: "blog-1",
        userId: "author-1",
        slug: "blog-1",
        name: "Blog",
        isPublic: true,
      },
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

  describe("Blog isPublic 2nd Defense", () => {
    it("throws NotFoundException when non-owner accesses post from private blog via slug", async () => {
      const {
        service,
        cacheService,
        postsReadRepository,
        postMapperService,
        postInteractionStatusService,
      } = createService();

      cacheService.get.mockResolvedValue(null);
      cacheService.acquireLock.mockResolvedValue(true);

      const postEntity = {
        id: "post-private-1",
        slug: "private-post",
        title: "Private blog post",
        isPublished: true,
        authorId: "author-1",
        author: { id: "author-1", username: "author" },
        blog: {
          id: "blog-1",
          userId: "author-1",
          slug: "private-blog",
          isPublic: false,
        },
      };
      postsReadRepository.findBySlugWithRelations.mockResolvedValue(postEntity);

      const nonOwnerUser = { id: "other-user", role: "user" } as any;

      await expect(
        service.findBySlug("private-post", nonOwnerUser),
      ).rejects.toThrow("게시글을 찾을 수 없습니다.");
    });

    it("allows blog owner to access post from private blog via slug", async () => {
      const {
        service,
        cacheService,
        postsReadRepository,
        postMapperService,
        postInteractionStatusService,
      } = createService();

      cacheService.get.mockResolvedValue(null);
      cacheService.acquireLock.mockResolvedValue(true);

      const postEntity = {
        id: "post-private-2",
        slug: "owner-post",
        title: "Private blog post for owner",
        isPublished: true,
        authorId: "author-1",
        author: { id: "author-1", username: "author" },
        blog: {
          id: "blog-1",
          userId: "author-1",
          slug: "private-blog",
          isPublic: false,
        },
      };
      postsReadRepository.findBySlugWithRelations.mockResolvedValue(postEntity);
      postMapperService.toPostDto.mockResolvedValue({
        id: "post-private-2",
        slug: "owner-post",
        title: "Private blog post for owner",
        liked: false,
        bookmarked: false,
        userVote: null,
      });
      postInteractionStatusService.getMultipleInteractionStatuses.mockResolvedValue(
        new Map(),
      );

      const ownerUser = { id: "author-1", role: "user" } as any;
      const result = await service.findBySlug("owner-post", ownerUser);

      expect(result.id).toBe("post-private-2");
    });

    it("throws NotFoundException when non-owner accesses post from private blog via id", async () => {
      const { service, cacheService, postsReadRepository } = createService();

      cacheService.get.mockResolvedValue(null);
      cacheService.acquireLock.mockResolvedValue(true);

      const postEntity = {
        id: "post-private-3",
        slug: "private-by-id",
        title: "Private blog post by id",
        isPublished: true,
        authorId: "author-1",
        author: { id: "author-1", username: "author" },
        blog: {
          id: "blog-1",
          userId: "author-1",
          slug: "private-blog",
          isPublic: false,
        },
      };
      postsReadRepository.findByIdWithRelations.mockResolvedValue(postEntity);

      const nonOwnerUser = { id: "other-user", role: "user" } as any;

      await expect(
        service.findById("post-private-3", ["author", "blog"], nonOwnerUser),
      ).rejects.toThrow("게시글을 찾을 수 없습니다.");
    });

    it("allows post access when blog is public", async () => {
      const {
        service,
        cacheService,
        postsReadRepository,
        postMapperService,
        postInteractionStatusService,
      } = createService();

      cacheService.get.mockResolvedValue(null);
      cacheService.acquireLock.mockResolvedValue(true);

      const postEntity = {
        id: "post-public-1",
        slug: "public-post",
        title: "Public blog post",
        isPublished: true,
        authorId: "author-1",
        author: { id: "author-1", username: "author" },
        blog: {
          id: "blog-1",
          userId: "author-1",
          slug: "public-blog",
          isPublic: true,
        },
      };
      postsReadRepository.findBySlugWithRelations.mockResolvedValue(postEntity);
      postMapperService.toPostDto.mockResolvedValue({
        id: "post-public-1",
        slug: "public-post",
        title: "Public blog post",
        liked: false,
        bookmarked: false,
        userVote: null,
      });
      postInteractionStatusService.getMultipleInteractionStatuses.mockResolvedValue(
        new Map(),
      );

      const anyUser = { id: "random-user", role: "user" } as any;
      const result = await service.findBySlug("public-post", anyUser);

      expect(result.id).toBe("post-public-1");
    });

    it("throws NotFoundException when non-owner accesses private-visibility post", async () => {
      const { service, cacheService, postsReadRepository } = createService();

      cacheService.get.mockResolvedValue(null);
      cacheService.acquireLock.mockResolvedValue(true);

      postsReadRepository.findBySlugWithRelations.mockResolvedValue({
        id: "post-private-visibility-1",
        slug: "secret-post",
        title: "Secret post",
        isPublished: true,
        visibility: "private",
        authorId: "author-1",
        author: { id: "author-1", username: "author" },
        blog: {
          id: "blog-1",
          userId: "author-1",
          slug: "public-blog",
          isPublic: true,
        },
      });

      await expect(
        service.findBySlug("secret-post", { id: "other-user", role: "user" } as any),
      ).rejects.toThrow("게시글을 찾을 수 없습니다.");
    });

    it("does not cache private-visibility posts even when published", async () => {
      const {
        service,
        cacheService,
        postsReadRepository,
        postMapperService,
        postInteractionStatusService,
      } = createService();

      cacheService.get.mockResolvedValue(null);
      cacheService.acquireLock.mockResolvedValue(true);

      postsReadRepository.findBySlugWithRelations.mockResolvedValue({
        id: "post-private-visibility-2",
        slug: "owner-secret-post",
        title: "Owner Secret",
        isPublished: true,
        visibility: "private",
        authorId: "author-1",
        author: { id: "author-1", username: "author" },
        blog: {
          id: "blog-1",
          userId: "author-1",
          slug: "public-blog",
          isPublic: true,
        },
      });

      postMapperService.toPostDto.mockResolvedValue({
        id: "post-private-visibility-2",
        slug: "owner-secret-post",
        title: "Owner Secret",
        visibility: "private",
        isPublished: true,
      });
      postInteractionStatusService.getMultipleInteractionStatuses.mockResolvedValue(
        new Map(),
      );

      await service.findBySlug(
        "owner-secret-post",
        { id: "author-1", role: "user" } as any,
      );

      expect(cacheService.set).not.toHaveBeenCalledWith(
        CacheKeys.POST_CORE("post-private-visibility-2"),
        expect.anything(),
        expect.anything(),
      );
    });
  });
});
