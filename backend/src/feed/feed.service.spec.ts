import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { FeedService } from "./feed.service";
import { FeedRankingService } from "./feed-ranking.service";
import { CacheService } from "../cache/cache.service";
import { Post } from "../posts/entities/post.entity";
import { CommunityPost } from "../communities/entities/community-post.entity";
import { FeedFilterType, FeedSortType } from "./dto";

describe("FeedService - Community Visibility Filters", () => {
  let service: FeedService;
  const mockPostRepository = {};
  const mockCommunityPostRepository = {};
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };
  const mockFeedRankingService = {
    getRankedEntries: jest.fn(),
  };
  const mockQueryRunner = {
    query: jest.fn().mockResolvedValue([]),
    release: jest.fn(),
  };
  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
    createQueryRunner: jest.fn(() => mockQueryRunner),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeedService,
        { provide: getRepositoryToken(Post), useValue: mockPostRepository },
        {
          provide: getRepositoryToken(CommunityPost),
          useValue: mockCommunityPostRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CacheService, useValue: mockCacheService },
        { provide: FeedRankingService, useValue: mockFeedRankingService },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("filters community posts by discoverability in unified feed query", async () => {
    await (service as any).executeUnifiedQuery(
      FeedFilterType.COMMUNITY,
      FeedSortType.RECENT,
      10,
      null,
      undefined,
    );

    const query = mockQueryRunner.query.mock.calls[0][0] as string;
    expect(query).toContain('c."isPublic" = true');
    expect(query).toContain('c."isPostDiscoverable" = true');
    expect(query).toContain("c.\"joinPolicy\" <> 'private'");
  });

  it("filters community posts by discoverability in ranked fetch", async () => {
    await (service as any).fetchFeedItemsByIds([], ["community-id"], undefined);

    const query = mockDataSource.query.mock.calls[0][0] as string;
    expect(query).toContain('c."isPublic" = true');
    expect(query).toContain('c."isPostDiscoverable" = true');
    expect(query).toContain("c.\"joinPolicy\" <> 'private'");
  });

  it("includes blog isPublic filter in unified blog query", async () => {
    await (service as any).executeUnifiedQuery(
      "blog",
      FeedSortType.RECENT,
      10,
      null,
      undefined,
    );

    const query = mockQueryRunner.query.mock.calls[0][0] as string;
    expect(query).toContain("INNER JOIN blogs b");
    expect(query).toContain('b."isPublic" = true');
    expect(query).toContain("p.visibility = 'public'");
  });

  it("includes blog isPublic filter in blog feed items fetch", async () => {
    await (service as any).fetchFeedItemsByIds(["blog-post-id"], [], undefined);

    const query = mockDataSource.query.mock.calls[0][0] as string;
    expect(query).toContain("INNER JOIN blogs b");
    expect(query).toContain('b."isPublic" = true');
    expect(query).toContain("p.visibility = 'public'");
  });

  it("includes category field in blog feed query projection", async () => {
    await (service as any).fetchFeedItemsByIds(
      ["blog-post-id"],
      [],
      undefined,
    );

    const query = mockDataSource.query.mock.calls[0][0] as string;
    expect(query).toContain("pm.category as category");
    expect(query).toContain("meta.category");
  });

  it("includes null category placeholder in community feed query projection", async () => {
    await (service as any).fetchFeedItemsByIds(
      [],
      ["community-post-id"],
      undefined,
    );

    const query = mockDataSource.query.mock.calls[0][0] as string;
    expect(query).toContain("NULL::text as category");
  });

  it("keeps category column aligned in recent unified query", async () => {
    await (service as any).executeUnifiedQuery(
      FeedFilterType.ALL,
      FeedSortType.RECENT,
      10,
      null,
      undefined,
    );

    const query = mockDataSource.query.mock.calls[0][0] as string;
    expect(query).toContain("pm.category as category");
    expect(query).toContain("NULL::text as category");
  });

  it("maps category from raw unified feed rows", () => {
    const item = (service as any).mapToFeedItem({
      id: "post-id",
      title: "hello",
      slug: "hello",
      excerpt: "summary",
      category: "ai/safety",
      source_type: "blog",
      user_id: "user-id",
      username: "admin",
      like_count: "4",
      comment_count: "2",
      view_count: "10",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    });

    expect(item.category).toBe("ai/safety");
    expect(item.blog).toBeUndefined();
    expect(item.community).toBeUndefined();
  });
});
