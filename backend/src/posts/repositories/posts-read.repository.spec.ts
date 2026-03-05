import { PostsReadRepository } from "./posts-read.repository";

describe("PostsReadRepository", () => {
  const postAccessPolicyServiceMock = {
    getPublicVisibilityQueryValue: jest.fn(() => "public"),
  };

  const createQueryBuilderMock = () => {
    const queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
    };

    return queryBuilder;
  };

  it("matches blogSlug against slug and alias after normalizing @ prefix", () => {
    const queryBuilder = createQueryBuilderMock();
    const postsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const repository = new PostsReadRepository(
      {} as any,
      postsRepository as any,
      postAccessPolicyServiceMock as any,
    );

    repository.getCursorPaginatedQueryBuilder({
      blogSlug: "@park",
      limit: 20,
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(blog.slug = :blogIdentifier OR blog.alias = :blogIdentifier)",
      expect.objectContaining({ blogIdentifier: "park" }),
    );
  });

  it("prefers blogId filter when blogId is provided", () => {
    const queryBuilder = createQueryBuilderMock();
    const postsRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    const repository = new PostsReadRepository(
      {} as any,
      postsRepository as any,
      postAccessPolicyServiceMock as any,
    );

    repository.getCursorPaginatedQueryBuilder({
      blogId: "blog-1",
      blogSlug: "@park",
      limit: 20,
    } as any);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "blog.id = :blogId",
      expect.objectContaining({ blogId: "blog-1" }),
    );
  });

  describe("Blog Visibility Filters (isPublic)", () => {
    it("applies isPublished and isDeleted filters for unauthenticated users", () => {
      const queryBuilder = createQueryBuilderMock();
      const postsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const repository = new PostsReadRepository(
        {} as any,
        postsRepository as any,
        postAccessPolicyServiceMock as any,
      );

      repository.getCursorPaginatedQueryBuilder({
        limit: 20,
      } as any);

      // 기본 필터 항상 적용
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "post.isPublished = :isPublished",
        expect.objectContaining({
          isPublished: true,
          isDeleted: false,
        }),
      );
    });

    it("applies blog.isPublic = true for unauthenticated users", () => {
      const queryBuilder = createQueryBuilderMock();
      const postsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const repository = new PostsReadRepository(
        {} as any,
        postsRepository as any,
        postAccessPolicyServiceMock as any,
      );

      // user 없이 호출 (비로그인)
      repository.getCursorPaginatedQueryBuilder({
        limit: 20,
      } as any);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "blog.isPublic = :isPublic",
        expect.objectContaining({ isPublic: true }),
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "post.visibility = :postVisibility",
        expect.objectContaining({ postVisibility: "public" }),
      );
    });

    it("applies OR-based visibility for authenticated users (public OR owner)", () => {
      const queryBuilder = createQueryBuilderMock();
      const postsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const repository = new PostsReadRepository(
        {} as any,
        postsRepository as any,
        postAccessPolicyServiceMock as any,
      );

      const user = { id: "user-123", role: "user" } as any;
      repository.getCursorPaginatedQueryBuilder({ limit: 20 } as any, user);

      // OR 조건 visibility 필터
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "((blog.isPublic = true AND post.visibility = :postVisibility) OR blog.userId = :viewerId OR post.authorId = :viewerId OR :userRole = 'admin')",
        expect.objectContaining({ viewerId: "user-123", userRole: "user" }),
      );
    });

    it("allows admin to bypass visibility filters", () => {
      const queryBuilder = createQueryBuilderMock();
      const postsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const repository = new PostsReadRepository(
        {} as any,
        postsRepository as any,
        postAccessPolicyServiceMock as any,
      );

      const adminUser = { id: "admin-1", role: "admin" } as any;
      repository.getCursorPaginatedQueryBuilder(
        { limit: 20 } as any,
        adminUser,
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "((blog.isPublic = true AND post.visibility = :postVisibility) OR blog.userId = :viewerId OR post.authorId = :viewerId OR :userRole = 'admin')",
        expect.objectContaining({ userRole: "admin" }),
      );
    });

    it("always applies isPublished and isDeleted even for authenticated users", () => {
      const queryBuilder = createQueryBuilderMock();
      const postsRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      };
      const repository = new PostsReadRepository(
        {} as any,
        postsRepository as any,
        postAccessPolicyServiceMock as any,
      );

      const user = { id: "user-456", role: "user" } as any;
      repository.getCursorPaginatedQueryBuilder({ limit: 20 } as any, user);

      // 로그인 사용자에도 기본 필터 적용
      expect(queryBuilder.where).toHaveBeenCalledWith(
        "post.isPublished = :isPublished",
        expect.objectContaining({
          isPublished: true,
          isDeleted: false,
        }),
      );
    });
  });
});
