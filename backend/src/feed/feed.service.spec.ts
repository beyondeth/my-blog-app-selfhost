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
});
