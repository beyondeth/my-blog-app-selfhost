import { Test, TestingModule } from "@nestjs/testing";
import { BlogsController } from "./blogs.controller";
import { BlogsService } from "./blogs.service";
import { BlogStatsService } from "../common/services/blog-stats.service";
import { BlogResolverService } from "../common/services/blog-resolver.service";
import { Role } from "../common/enums/role.enum";

describe("BlogsController - getBlogCategories", () => {
  let controller: BlogsController;

  const mockBlogsService = {};
  const mockBlogResolverService = {
    resolveBlogByIdentifier: jest.fn(),
  };
  const mockBlogStatsService = {
    getBlogCategoriesWithCountById: jest.fn(),
  };

  const createUser = (overrides: any = {}) =>
    ({
      id: "user-id",
      role: Role.USER,
      ...overrides,
    }) as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BlogsController],
      providers: [
        { provide: BlogsService, useValue: mockBlogsService },
        { provide: BlogResolverService, useValue: mockBlogResolverService },
        { provide: BlogStatsService, useValue: mockBlogStatsService },
      ],
    }).compile();

    controller = module.get<BlogsController>(BlogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns empty result when blog is not found", async () => {
    mockBlogResolverService.resolveBlogByIdentifier.mockResolvedValue(null);

    const result = await controller.getBlogCategories("missing");

    expect(result).toEqual({
      items: [],
      total: 0,
      hasMore: false,
      nextCursor: null,
    });
    expect(mockBlogStatsService.getBlogCategoriesWithCountById).not.toHaveBeenCalled();
  });

  it("denies private blog categories to anonymous user", async () => {
    mockBlogResolverService.resolveBlogByIdentifier.mockResolvedValue({
      id: "blog-id",
      userId: "owner-id",
      slug: "owner",
      alias: "owner",
      isPublic: false,
    });

    const result = await controller.getBlogCategories("owner");

    expect(result).toEqual({
      items: [],
      total: 0,
      hasMore: false,
      nextCursor: null,
    });
    expect(mockBlogStatsService.getBlogCategoriesWithCountById).not.toHaveBeenCalled();
  });

  it("returns empty result for private blog requested by non-owner and non-admin", async () => {
    mockBlogResolverService.resolveBlogByIdentifier.mockResolvedValue({
      id: "blog-id",
      userId: "owner-id",
      slug: "owner",
      alias: "owner",
      isPublic: false,
    });

    const viewer = createUser({ id: "other-user" });

    const result = await controller.getBlogCategories("owner", viewer);

    expect(result).toEqual({
      items: [],
      total: 0,
      hasMore: false,
      nextCursor: null,
    });
    expect(mockBlogStatsService.getBlogCategoriesWithCountById).not.toHaveBeenCalled();
  });

  it("allows owner to see private blog categories with includePrivate=true", async () => {
    const categories = [
      { category: "기술", count: 10 },
      { category: "일상", count: 2 },
    ];

    mockBlogResolverService.resolveBlogByIdentifier.mockResolvedValue({
      id: "blog-id",
      userId: "owner-id",
      slug: "owner",
      alias: "owner",
      isPublic: false,
    });
    mockBlogStatsService.getBlogCategoriesWithCountById.mockResolvedValue(categories);

    const owner = createUser({ id: "owner-id" });

    const result = await controller.getBlogCategories("owner", owner, "1", undefined);

    expect(mockBlogStatsService.getBlogCategoriesWithCountById).toHaveBeenCalledWith(
      "blog-id",
      { includePrivate: true },
    );
    expect(result).toMatchObject({
      items: [categories[0]],
      total: 2,
      hasMore: true,
      nextCursor: expect.any(String),
    });
  });

  it("allows admin to see private blog categories with includePrivate=true", async () => {
    const categories = [{ category: "기술", count: 1 }];

    mockBlogResolverService.resolveBlogByIdentifier.mockResolvedValue({
      id: "blog-id",
      userId: "owner-id",
      slug: "owner",
      alias: "owner",
      isPublic: false,
    });
    mockBlogStatsService.getBlogCategoriesWithCountById.mockResolvedValue(categories);

    const admin = createUser({ id: "admin-id", role: Role.ADMIN });

    const result = await controller.getBlogCategories("owner", admin, "20");

    expect(mockBlogStatsService.getBlogCategoriesWithCountById).toHaveBeenCalledWith(
      "blog-id",
      { includePrivate: true },
    );
    expect(result.items).toEqual(categories);
  });

  it("uses public scope for public blog even when user is anonymous", async () => {
    const categories = [{ category: "일상", count: 4 }];

    mockBlogResolverService.resolveBlogByIdentifier.mockResolvedValue({
      id: "blog-id",
      userId: "owner-id",
      slug: "owner",
      alias: "owner",
      isPublic: true,
    });
    mockBlogStatsService.getBlogCategoriesWithCountById.mockResolvedValue(categories);

    await controller.getBlogCategories("owner");

    expect(mockBlogStatsService.getBlogCategoriesWithCountById).toHaveBeenCalledWith(
      "blog-id",
      { includePrivate: false },
    );
  });
});
