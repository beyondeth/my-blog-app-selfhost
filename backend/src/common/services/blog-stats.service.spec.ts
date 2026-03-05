import { BlogStatsService } from "./blog-stats.service";
import { CacheTTL } from "../../cache/cache.service";

describe("BlogStatsService - Category Visibility + Cache", () => {
  let service: BlogStatsService;

  const mockPostRepository = {
    createQueryBuilder: jest.fn(),
  };
  const mockBlogRepository = {};
  const mockBlogStatsRepository = {};
  const mockStatsSnapshotRepository = {};
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const buildQueryBuilder = () => {
    const qb: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { category: null, count: "2" },
        { category: "기술", count: "1" },
      ]),
    };
    return qb;
  };

  beforeEach(() => {
    const queryBuilder = buildQueryBuilder();
    mockPostRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    service = new BlogStatsService(
      mockPostRepository as any,
      mockBlogRepository as any,
      mockBlogStatsRepository as any,
      mockStatsSnapshotRepository as any,
      mockCacheService as any,
    );

    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns cached categories when cache exists", async () => {
    const cached = [{ category: "카테고리", count: 5 }];
    mockCacheService.get.mockResolvedValueOnce(cached);

    const result = await service.getBlogCategoriesWithCountById("blog-id");

    expect(result).toEqual(cached);
    expect(mockPostRepository.createQueryBuilder).not.toHaveBeenCalled();
    expect(mockCacheService.set).not.toHaveBeenCalled();
  });

  it("builds public-only category query when includePrivate is false", async () => {
    const qb = buildQueryBuilder();
    mockPostRepository.createQueryBuilder.mockReturnValue(qb);

    const result = await service.getBlogCategoriesWithCountById("blog-id");

    expect(mockPostRepository.createQueryBuilder).toHaveBeenCalledWith("post");
    expect(qb.where).toHaveBeenCalledWith("post.blogId = :blogId", {
      blogId: "blog-id",
    });
    expect(qb.andWhere).toHaveBeenCalledWith("post.isDeleted = :isDeleted", {
      isDeleted: false,
    });
    expect(qb.andWhere).toHaveBeenCalledWith("post.isPublished = :isPublished", {
      isPublished: true,
    });
    expect(qb.andWhere).toHaveBeenCalledWith(
      "post.visibility = :publicVisibility",
      { publicVisibility: "public" },
    );
    expect(qb.getRawMany).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      "blog:stats:categories:id:blog-id:public",
      [
        { category: "미분류", count: 2 },
        { category: "기술", count: 1 },
      ],
      CacheTTL.MEDIUM,
    );
    expect(result).toEqual([
      { category: "미분류", count: 2 },
      { category: "기술", count: 1 },
    ]);
  });

  it("builds all-scope query when includePrivate is true", async () => {
    const qb = buildQueryBuilder();
    mockPostRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getBlogCategoriesWithCountById("blog-id", {
      includePrivate: true,
    });

    expect(mockCacheService.get).toHaveBeenCalledWith(
      "blog:stats:categories:id:blog-id:all",
    );
    expect(qb.andWhere).toHaveBeenCalledWith("1=1", {});
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      "post.visibility = :publicVisibility",
      { publicVisibility: "public" },
    );
    expect(mockCacheService.set).toHaveBeenCalledWith(
      "blog:stats:categories:id:blog-id:all",
      [
        { category: "미분류", count: 2 },
        { category: "기술", count: 1 },
      ],
      CacheTTL.MEDIUM,
    );
  });

  it("keeps cache keys scoped by visibility mode", async () => {
    const qb = buildQueryBuilder();
    mockPostRepository.createQueryBuilder.mockReturnValue(qb);

    await service.getBlogCategoriesWithCountById("blog-id");
    await service.getBlogCategoriesWithCountById("blog-id", {
      includePrivate: true,
    });

    expect(mockCacheService.set).toHaveBeenCalledWith(
      "blog:stats:categories:id:blog-id:public",
      expect.any(Array),
      CacheTTL.MEDIUM,
    );
    expect(mockCacheService.set).toHaveBeenCalledWith(
      "blog:stats:categories:id:blog-id:all",
      expect.any(Array),
      CacheTTL.MEDIUM,
    );
  });
});
