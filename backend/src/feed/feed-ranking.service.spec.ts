import { FeedRankingService } from "./feed-ranking.service";
import { FeedSortType } from "./dto";

describe("FeedRankingService - Community Visibility Filters", () => {
  const mockDataSource = {
    query: jest.fn().mockResolvedValue([]),
  };
  const mockRedis = {
    pipeline: jest.fn(() => ({
      del: jest.fn(),
      zadd: jest.fn(),
      expire: jest.fn(),
      exec: jest.fn(),
    })),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("adds community visibility filters to ranking query", async () => {
    const service = new FeedRankingService(
      mockDataSource as any,
      mockRedis as any,
    );

    await (service as any).fetchRankingRows(FeedSortType.HOT, 10);

    const query = mockDataSource.query.mock.calls[0][0] as string;
    expect(query).toContain("INNER JOIN communities c");
    expect(query).toContain('c."isPublic" = true');
    expect(query).toContain('c."isPostDiscoverable" = true');
    expect(query).toContain("c.\"joinPolicy\" <> 'private'");
  });
});
