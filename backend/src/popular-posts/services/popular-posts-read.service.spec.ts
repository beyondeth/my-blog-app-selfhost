import { PopularPostsReadService } from "./popular-posts-read.service";

describe("PopularPostsReadService", () => {
  let service: PopularPostsReadService;

  const mockPopularCacheService = {
    get: jest.fn(),
    setAtomic: jest.fn(),
  };

  const mockPopularSnapshotService = {
    getTop: jest.fn(),
    replaceSnapshot: jest.fn(),
  };

  const mockPopularScoreQueryService = {
    calculatePopularRows: jest.fn(),
  };

  beforeEach(() => {
    service = new PopularPostsReadService(
      mockPopularCacheService as any,
      mockPopularSnapshotService as any,
      mockPopularScoreQueryService as any,
    );
    mockPopularCacheService.setAtomic.mockResolvedValue(undefined);
    mockPopularSnapshotService.replaceSnapshot.mockResolvedValue(undefined);
    mockPopularScoreQueryService.calculatePopularRows.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("normalizes period and limit safely", () => {
    expect(service.normalizePeriod("daily")).toBe("daily");
    expect(service.normalizePeriod("weekly")).toBe("weekly");
    expect(service.normalizePeriod("monthly")).toBe("monthly");
    expect(service.normalizePeriod("invalid")).toBe("weekly");
    expect(service.normalizePeriod()).toBe("weekly");

    expect(service.normalizeLimit("3")).toBe(3);
    expect(service.normalizeLimit(999)).toBe(20);
    expect(service.normalizeLimit("0")).toBe(5);
    expect(service.normalizeLimit("-1", 7)).toBe(7);
    expect(service.normalizeLimit(undefined, 9)).toBe(9);
  });

  it("returns cached blog posts first when cache is populated", async () => {
    mockPopularCacheService.get.mockResolvedValue({
      generatedAt: "2026-02-26T00:00:00.000Z",
      items: [{ id: "a" }, { id: "b" }, { id: "c" }],
    });

    const result = await service.getBlogPopularPosts("daily", 2);

    expect(result).toEqual({
      posts: [{ id: "a" }, { id: "b" }],
      total: 2,
    });
    expect(mockPopularSnapshotService.getTop).not.toHaveBeenCalled();
    expect(mockPopularCacheService.setAtomic).not.toHaveBeenCalled();
    expect(
      mockPopularScoreQueryService.calculatePopularRows,
    ).not.toHaveBeenCalled();
  });

  it("reads snapshot on cache miss, refills cache, and returns limited community items", async () => {
    const snapshotAt = new Date("2026-02-26T11:00:00.000Z");
    mockPopularCacheService.get.mockResolvedValue(null);
    mockPopularSnapshotService.getTop.mockResolvedValue([
      { snapshotAt, metaJson: { id: "c1" } },
      { snapshotAt, metaJson: { id: "c2" } },
      { snapshotAt, metaJson: { id: "c3" } },
    ]);

    const result = await service.getCommunityPopularPosts("weekly", 2);

    expect(mockPopularSnapshotService.getTop).toHaveBeenCalledWith(
      "community",
      "weekly",
      200,
    );
    expect(mockPopularCacheService.setAtomic).toHaveBeenCalledWith(
      "community",
      "weekly",
      {
        generatedAt: snapshotAt.toISOString(),
        items: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
      },
    );
    expect(result).toEqual({
      items: [{ id: "c1" }, { id: "c2" }],
      total: 2,
    });
  });

  it("serves snapshot data even when cache refill fails", async () => {
    mockPopularCacheService.get.mockResolvedValue(null);
    mockPopularSnapshotService.getTop.mockResolvedValue([
      {
        snapshotAt: new Date("2026-02-26T12:00:00.000Z"),
        metaJson: { id: "p1" },
      },
      {
        snapshotAt: new Date("2026-02-26T12:00:00.000Z"),
        metaJson: { id: "p2" },
      },
    ]);
    mockPopularCacheService.setAtomic.mockRejectedValue(new Error("redis down"));

    const result = await service.getBlogPopularPosts("monthly", 5);

    expect(result).toEqual({
      posts: [{ id: "p1" }, { id: "p2" }],
      total: 2,
    });
  });

  it("returns empty list when cache and snapshot are both empty", async () => {
    mockPopularCacheService.get.mockResolvedValue(null);
    mockPopularSnapshotService.getTop.mockResolvedValue([]);
    mockPopularScoreQueryService.calculatePopularRows.mockResolvedValue([]);

    const result = await service.getBlogPopularPosts("daily", 5);

    expect(result).toEqual({ posts: [], total: 0 });
    expect(mockPopularScoreQueryService.calculatePopularRows).toHaveBeenCalledWith(
      "blog",
      "daily",
      200,
    );
    expect(mockPopularSnapshotService.replaceSnapshot).not.toHaveBeenCalled();
    expect(mockPopularCacheService.setAtomic).not.toHaveBeenCalled();
  });

  it("seeds snapshot/cache from live query when cache and snapshot are empty", async () => {
    mockPopularCacheService.get.mockResolvedValue(null);
    mockPopularSnapshotService.getTop.mockResolvedValue([]);
    mockPopularScoreQueryService.calculatePopularRows.mockResolvedValue([
      {
        postId: "seed-1",
        score: 10,
        metaJson: { id: "seed-1" },
      },
      {
        postId: "seed-2",
        score: 8,
        metaJson: { id: "seed-2" },
      },
    ]);

    const result = await service.getCommunityPopularPosts("weekly", 1);

    const replaceCall = mockPopularSnapshotService.replaceSnapshot.mock.calls[0];
    const cacheCall = mockPopularCacheService.setAtomic.mock.calls[0];
    const seededAt = replaceCall[2] as Date;

    expect(replaceCall).toEqual([
      "community",
      "weekly",
      expect.any(Date),
      [
        { postId: "seed-1", score: 10, metaJson: { id: "seed-1" } },
        { postId: "seed-2", score: 8, metaJson: { id: "seed-2" } },
      ],
    ]);
    expect(cacheCall).toEqual([
      "community",
      "weekly",
      {
        generatedAt: seededAt.toISOString(),
        items: [{ id: "seed-1" }, { id: "seed-2" }],
      },
    ]);
    expect(result).toEqual({
      items: [{ id: "seed-1" }],
      total: 1,
    });
  });
});
