import { DataSource } from "typeorm";
import { PopularScoreQueryService } from "./popular-score-query.service";

describe("PopularScoreQueryService", () => {
  let service: PopularScoreQueryService;

  const mockDataSource = {
    query: jest.fn(),
  };

  const originalMinScore = process.env.POPULAR_MIN_SCORE;

  beforeEach(() => {
    service = new PopularScoreQueryService(
      mockDataSource as unknown as DataSource,
    );
  });

  afterEach(() => {
    process.env.POPULAR_MIN_SCORE = originalMinScore;
    jest.clearAllMocks();
  });

  it("builds blog query with daily interval and configured min score", async () => {
    process.env.POPULAR_MIN_SCORE = "3";
    mockDataSource.query.mockResolvedValue([
      { postId: "p1", score: 10, metaJson: { id: "p1" } },
    ]);

    const result = await service.calculatePopularRows("blog", "daily", 15);

    expect(result).toEqual([
      { postId: "p1", score: 10, metaJson: { id: "p1" } },
    ]);
    const [query, params] = mockDataSource.query.mock.calls[0] as [
      string,
      [number, number],
    ];
    expect(query).toContain(`INTERVAL '24 hours'`);
    expect(query).toContain(`INNER JOIN blogs b`);
    expect(query).toContain(`b."isPublic" = true`);
    expect(query).toContain(`p.visibility = 'public'`);
    expect(params).toEqual([15, 3]);
  });

  it("builds community query with monthly interval", async () => {
    process.env.POPULAR_MIN_SCORE = "5";
    mockDataSource.query.mockResolvedValue([
      { postId: "c1", score: 99, metaJson: { id: "c1" } },
    ]);

    await service.calculatePopularRows("community", "monthly", 20);

    const [query, params] = mockDataSource.query.mock.calls[0] as [
      string,
      [number, number],
    ];
    expect(query).toContain(`INTERVAL '30 days'`);
    expect(query).toContain(`FROM community_posts cp`);
    expect(params).toEqual([20, 5]);
  });

  it("falls back to min score 1 when POPULAR_MIN_SCORE is invalid", async () => {
    process.env.POPULAR_MIN_SCORE = "-10";
    mockDataSource.query.mockResolvedValue([]);

    await service.calculatePopularRows("blog", "weekly", 7);

    const [, params] = mockDataSource.query.mock.calls[0] as [
      string,
      [number, number],
    ];
    expect(params).toEqual([7, 1]);
  });
});
