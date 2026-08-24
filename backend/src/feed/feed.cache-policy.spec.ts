import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { FeedService } from "./feed.service";
import { FeedRankingService } from "./feed-ranking.service";
import { CacheService, CacheTTL } from "../cache/cache.service";
import { Post } from "../posts/entities/post.entity";
import { CommunityPost } from "../communities/entities/community-post.entity";
import { FeedFilterType, FeedPeriodType, FeedSortType } from "./dto";
import { CdnService } from "../files/services/cdn.service";

describe("FeedService - Cache Policy", () => {
  let service: FeedService;
  const originalHotPeriodTtl = process.env.FEED_HOT_PERIOD_TTL_SECONDS;

  const mockPostRepository = {};
  const mockCommunityPostRepository = {};
  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  };
  const mockFeedRankingService = {
    getRankedEntries: jest.fn(),
  };
  const mockCdnService = {
    generateCdnUrlFromKey: jest.fn(
      (key: string) => `https://cdn.aigory.com/${key}`,
    ),
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
        { provide: CdnService, useValue: mockCdnService },
      ],
    }).compile();

    service = module.get<FeedService>(FeedService);
  });

  afterEach(() => {
    process.env.FEED_HOT_PERIOD_TTL_SECONDS = originalHotPeriodTtl;
    jest.clearAllMocks();
  });

  it("uses shared cache for logged-in user and attaches user votes", async () => {
    mockCacheService.get.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          sourceType: "blog",
          title: "blog item",
          createdAt: "2026-02-26T00:00:00.000Z",
        },
        {
          id: "00000000-0000-0000-0000-000000000002",
          sourceType: "community",
          title: "community item",
          createdAt: "2026-02-26T00:00:00.000Z",
        },
      ],
      hasMore: false,
      nextCursor: null,
      count: 2,
    });

    mockDataSource.query.mockImplementation(async (query: string) => {
      if (query.includes("FROM post_likes")) {
        return [
          { postId: "00000000-0000-0000-0000-000000000001", type: "upvote" },
        ];
      }
      return [];
    });

    const result = await service.getUnifiedFeed(
      {
        filter: FeedFilterType.ALL,
        sort: FeedSortType.RECENT,
        period: FeedPeriodType.DAILY,
        limit: 20,
      },
      "user-1",
    );

    expect(mockCacheService.get).toHaveBeenCalledTimes(1);
    const key = mockCacheService.get.mock.calls[0][0] as string;
    expect(key).toContain("feed:unified:all:recent:period:daily");

    expect(result.items[0].userVote).toBe("upvote");
    expect(result.items[0].liked).toBe(true);
    expect(result.items[1].userVote).toBeUndefined();
    expect(mockCacheService.set).not.toHaveBeenCalled();
  });

  it("on cache miss, builds shared payload then applies user votes without user-joined feed query", async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockDataSource.query.mockResolvedValue([]);

    const baseItems = [
      {
        id: "00000000-0000-0000-0000-000000000003",
        sourceType: "blog",
        title: "base item",
        createdAt: "2026-02-26T00:00:00.000Z",
      },
    ];

    const optimizedSpy = jest
      .spyOn(service as any, "executeRecentUnifiedQueryOptimized")
      .mockResolvedValue(baseItems);

    const voteSpy = jest
      .spyOn(service as any, "attachUserVotesToResponse")
      .mockImplementation(async (response: any) => response);

    await service.getUnifiedFeed(
      {
        filter: FeedFilterType.ALL,
        sort: FeedSortType.RECENT,
        period: FeedPeriodType.ALL,
        limit: 5,
      },
      "user-2",
    );

    expect(optimizedSpy).toHaveBeenCalledWith(
      6,
      null,
      undefined,
      FeedPeriodType.ALL,
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set.mock.calls[0][2]).toBe(CacheTTL.SHORT);
    expect(voteSpy).toHaveBeenCalledTimes(1);
  });

  it("uses extended TTL for hot/top with non-all periods", async () => {
    process.env.FEED_HOT_PERIOD_TTL_SECONDS = "900";
    service = new FeedService(
      mockPostRepository as any,
      mockCommunityPostRepository as any,
      mockDataSource as any,
      mockCacheService as any,
      mockFeedRankingService as any,
      mockCdnService as any,
    );

    mockCacheService.get.mockResolvedValue(null);
    jest.spyOn(service as any, "executeUnifiedQuery").mockResolvedValue([]);

    await service.getUnifiedFeed({
      filter: FeedFilterType.ALL,
      sort: FeedSortType.HOT,
      period: FeedPeriodType.DAILY,
      limit: 10,
    });

    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set.mock.calls[0][2]).toBe(900);
  });

  it("generates distinct cache keys per period to prevent period contamination", async () => {
    mockCacheService.get.mockResolvedValue(null);
    mockCacheService.set.mockResolvedValue(undefined);

    jest
      .spyOn(service as any, "executeRecentUnifiedQueryOptimized")
      .mockResolvedValue([]);

    await service.getUnifiedFeed({
      filter: FeedFilterType.ALL,
      sort: FeedSortType.RECENT,
      period: FeedPeriodType.DAILY,
      limit: 10,
    });

    await service.getUnifiedFeed({
      filter: FeedFilterType.ALL,
      sort: FeedSortType.RECENT,
      period: FeedPeriodType.MONTHLY,
      limit: 10,
    });

    const firstKey = mockCacheService.get.mock.calls[0][0] as string;
    const secondKey = mockCacheService.get.mock.calls[1][0] as string;

    expect(firstKey).toContain(":period:daily:");
    expect(secondKey).toContain(":period:monthly:");
    expect(firstKey).not.toBe(secondKey);
  });
});
