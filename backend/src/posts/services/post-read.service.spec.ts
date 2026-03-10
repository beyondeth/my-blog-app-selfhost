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

  it("resolves slug via public cache mapping for anonymous detail reads", async () => {
    const {
      service,
      cacheService,
      postsReadRepository,
    } = createService();

    cacheService.get.mockResolvedValueOnce("post-1").mockResolvedValueOnce({
      id: "post-1",
      slug: "hello-world",
      title: "Hello",
      liked: false,
      bookmarked: false,
      userVote: null,
    });

    const result = await service.findBySlug("hello-world");

    expect(postsReadRepository.findBySlugWithRelations).not.toHaveBeenCalled();
    expect(result.id).toBe("post-1");
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

  it("bypasses public detail cache for authenticated slug reads to build a gated viewer DTO", async () => {
    const {
      service,
      cacheService,
      postsReadRepository,
      postMapperService,
      postInteractionStatusService,
    } = createService();

    const postEntity = {
      id: "post-77",
      slug: "member-only-resource",
      title: "Member only resource",
      isPublished: true,
      isDeleted: false,
      visibility: "public",
      authorId: "author-1",
      author: { id: "author-1", username: "author" },
      blog: {
        id: "blog-1",
        userId: "author-1",
        slug: "blog-1",
        name: "Blog",
        isPublic: true,
      },
      metadata: {
        githubUrl: "https://github.com/example/repo",
      },
    };

    postsReadRepository.findBySlugWithRelations.mockResolvedValue(postEntity);
    postMapperService.toPostDto
      .mockResolvedValueOnce({
        id: "post-77",
        slug: "member-only-resource",
        githubUrl: null,
        hasGithubResource: true,
      })
      .mockResolvedValueOnce({
        id: "post-77",
        slug: "member-only-resource",
        githubUrl: "https://github.com/example/repo",
        hasGithubResource: true,
      });
    postInteractionStatusService.getMultipleInteractionStatuses.mockResolvedValue(
      new Map<string, any>(),
    );

    const result = await service.findBySlug("member-only-resource", {
      id: "viewer-1",
    } as any);

    expect(cacheService.get).not.toHaveBeenCalled();
    expect(postMapperService.toPostDto).toHaveBeenNthCalledWith(
      2,
      postEntity,
      expect.objectContaining({
        viewer: expect.objectContaining({ id: "viewer-1" }),
        exposeGithubResourceUrl: true,
      }),
    );
    expect(result.githubUrl).toBe("https://github.com/example/repo");
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

  describe("findMyPublishedPosts", () => {
    const createListQueryBuilder = () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[{ id: "post-1" }], 1]),
      };
      return qb;
    };

    it("queries only the user's published posts with filters", async () => {
      const { service, postsRepository } = createService();
      const queryBuilder = createListQueryBuilder();
      postsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findMyPublishedPosts("user-1", {
        page: 2,
        limit: 10,
        category: "Tech",
        tag: "mcp",
        dateFrom: "2026-03-01",
        dateTo: "2026-03-31",
      });

      expect(postsRepository.createQueryBuilder).toHaveBeenCalledWith("post");
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "post.authorId = :userId",
        {
          userId: "user-1",
        },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.isPublished = true",
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.status = :status",
        { status: "published" },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.isDeleted = false",
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.category = :category",
        { category: "Tech" },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith("post.tags @> :tag", {
        tag: JSON.stringify(["mcp"]),
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.publishedAt >= :dateFrom",
        { dateFrom: "2026-03-01" },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.publishedAt <= :dateTo",
        { dateTo: "2026-03-31" },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        "post.publishedAt",
        "DESC",
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        posts: [{ id: "post-1" }],
        total: 1,
        page: 2,
        limit: 10,
      });
    });

    it("applies search rank ordering when search is provided", async () => {
      const { service, postsRepository } = createService();
      const queryBuilder = createListQueryBuilder();
      postsRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await service.findMyPublishedPosts("user-1", {
        search: "react@hooks",
      });

      expect(queryBuilder.addSelect).toHaveBeenCalledWith(
        `ts_rank(post.search_vector, plainto_tsquery('simple', :searchQuery))`,
        "search_rank",
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining("post.search_vector @@ plainto_tsquery"),
        {
          searchQuery: "react hooks",
          searchLike: "%react hooks%",
        },
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith("search_rank", "DESC");
      expect(queryBuilder.addOrderBy).toHaveBeenCalledWith(
        "post.publishedAt",
        "DESC",
      );
    });
  });

  describe("findMyPublishedPostById", () => {
    it("returns a published post owned by the user", async () => {
      const { service, postsRepository } = createService();
      postsRepository.findOne.mockResolvedValue({ id: "post-7" });

      const result = await service.findMyPublishedPostById("user-1", "post-7");

      expect(postsRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: "post-7",
            authorId: "user-1",
            isPublished: true,
            status: "published",
            isDeleted: false,
          }),
        }),
      );
      expect(result).toEqual({ id: "post-7" });
    });

    it("throws when the post is not found for the user", async () => {
      const { service, postsRepository } = createService();
      postsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findMyPublishedPostById("user-1", "post-missing"),
      ).rejects.toThrow("발행된 포스트를 찾을 수 없습니다.");
    });
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
        service.findBySlug("secret-post", {
          id: "other-user",
          role: "user",
        } as any),
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

      await service.findBySlug("owner-secret-post", {
        id: "author-1",
        role: "user",
      } as any);

      expect(cacheService.set).not.toHaveBeenCalledWith(
        CacheKeys.POST_CORE("post-private-visibility-2"),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe("getRelatedPosts visibility", () => {
    const createQueryBuilderMock = () => {
      const qb: any = {
        innerJoin: jest.fn().mockReturnThis(),
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      return qb;
    };

    it("applies public filters for anonymous viewer", async () => {
      const { service, postsRepository } = createService();
      const relevanceQb = createQueryBuilderMock();
      const popularityQb = createQueryBuilderMock();

      postsRepository.findOne.mockResolvedValue({
        id: "post-1",
        blogId: "blog-1",
        authorId: "author-1",
        category: "Tech",
        tags: ["ai"],
        blog: { userId: "author-1", isPublic: false },
      });
      postsRepository.createQueryBuilder
        .mockReturnValueOnce(relevanceQb)
        .mockReturnValueOnce(popularityQb);

      await service.getRelatedPosts("post-1", 6, undefined);

      expect(relevanceQb.andWhere).toHaveBeenCalledWith(
        "post.visibility = :publicVisibility",
        { publicVisibility: "public" },
      );
      expect(relevanceQb.andWhere).toHaveBeenCalledWith("blog.isPublic = true");
      expect(popularityQb.andWhere).toHaveBeenCalledWith(
        "post.visibility = :publicVisibility",
        { publicVisibility: "public" },
      );
      expect(popularityQb.andWhere).toHaveBeenCalledWith(
        "blog.isPublic = true",
      );
    });

    it("does not apply public filters for owner viewer", async () => {
      const { service, postsRepository } = createService();
      const relevanceQb = createQueryBuilderMock();
      const popularityQb = createQueryBuilderMock();

      postsRepository.findOne.mockResolvedValue({
        id: "post-1",
        blogId: "blog-1",
        authorId: "author-1",
        category: "Tech",
        tags: ["ai"],
        blog: { userId: "author-1", isPublic: false },
      });
      postsRepository.createQueryBuilder
        .mockReturnValueOnce(relevanceQb)
        .mockReturnValueOnce(popularityQb);

      await service.getRelatedPosts("post-1", 6, {
        id: "author-1",
        role: "user",
      } as any);

      expect(relevanceQb.andWhere).not.toHaveBeenCalledWith(
        "post.visibility = :publicVisibility",
        expect.anything(),
      );
      expect(relevanceQb.andWhere).not.toHaveBeenCalledWith(
        "blog.isPublic = true",
      );
      expect(popularityQb.andWhere).not.toHaveBeenCalledWith(
        "post.visibility = :publicVisibility",
        expect.anything(),
      );
      expect(popularityQb.andWhere).not.toHaveBeenCalledWith(
        "blog.isPublic = true",
      );
    });
  });
});
