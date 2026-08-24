import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { FeedService } from "./feed.service";
import { FeedRankingService } from "./feed-ranking.service";
import { CacheService } from "../cache/cache.service";
import { Post } from "../posts/entities/post.entity";
import { CommunityPost } from "../communities/entities/community-post.entity";
import { FeedFilterType, FeedSortType } from "./dto";
import { CdnService } from "../files/services/cdn.service";

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

  it("maps legacy inline proxy images to the canonical CDN URL", () => {
    const result = (service as any).mapToFeedItem({
      id: "00000000-0000-0000-0000-000000000001",
      title: "Post",
      slug: "post",
      source_type: "blog",
      content_html:
        '<img src="http://localhost:3000/api/v1/files/proxy/uploads/image/2026/08/example.webp">',
      created_at: "2026-08-24T00:00:00.000Z",
      updated_at: "2026-08-24T00:00:00.000Z",
    });

    expect(result.images).toEqual([
      "https://cdn.aigory.com/uploads/image/2026/08/example.webp",
    ]);
    expect(result.thumbnail).toBe(
      "https://cdn.aigory.com/uploads/image/2026/08/example.webp",
    );
  });
});
