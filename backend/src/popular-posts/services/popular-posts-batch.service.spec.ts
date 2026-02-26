import { PopularPostsBatchService } from "./popular-posts-batch.service";

describe("PopularPostsBatchService", () => {
  let service: PopularPostsBatchService;

  const mockPopularScoreQueryService = {
    logQueryStart: jest.fn(),
    calculatePopularRows: jest.fn(),
  };

  const mockPopularSnapshotService = {
    replaceSnapshot: jest.fn(),
    logSnapshotResult: jest.fn(),
  };

  const mockPopularCacheService = {
    setAtomic: jest.fn(),
  };

  const defaultRows = [
    {
      postId: "post-1",
      score: 42,
      metaJson: { id: "post-1", title: "popular" },
    },
  ];

  beforeEach(() => {
    service = new PopularPostsBatchService(
      mockPopularScoreQueryService as any,
      mockPopularSnapshotService as any,
      mockPopularCacheService as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("processes all buckets and writes both snapshot and cache", async () => {
    mockPopularScoreQueryService.calculatePopularRows.mockResolvedValue(
      defaultRows,
    );

    await service.executeBatch("manual");

    expect(mockPopularScoreQueryService.calculatePopularRows).toHaveBeenCalledTimes(
      6,
    );
    expect(mockPopularSnapshotService.replaceSnapshot).toHaveBeenCalledTimes(6);
    expect(mockPopularCacheService.setAtomic).toHaveBeenCalledTimes(6);

    const bucketCalls =
      mockPopularScoreQueryService.calculatePopularRows.mock.calls.map(
        ([source, period]: [string, string]) => `${source}:${period}`,
      );

    expect(bucketCalls).toEqual(
      expect.arrayContaining([
        "blog:daily",
        "blog:weekly",
        "blog:monthly",
        "community:daily",
        "community:weekly",
        "community:monthly",
      ]),
    );
  });

  it("skips when previous batch is still running", async () => {
    (service as any).isRunning = true;
    const warnSpy = jest
      .spyOn((service as any).logger, "warn")
      .mockImplementation(() => undefined);

    await service.executeBatch("manual");

    expect(warnSpy).toHaveBeenCalled();
    expect(mockPopularScoreQueryService.calculatePopularRows).not.toHaveBeenCalled();
  });

  it("continues other buckets when one bucket fails", async () => {
    let callIndex = 0;
    mockPopularScoreQueryService.calculatePopularRows.mockImplementation(
      async () => {
        callIndex += 1;
        if (callIndex === 1) {
          throw new Error("query failed");
        }
        return defaultRows;
      },
    );
    const errorSpy = jest
      .spyOn((service as any).logger, "error")
      .mockImplementation(() => undefined);

    await service.executeBatch("manual");

    expect(mockPopularScoreQueryService.calculatePopularRows).toHaveBeenCalledTimes(
      6,
    );
    expect(mockPopularSnapshotService.replaceSnapshot).toHaveBeenCalledTimes(5);
    expect(mockPopularCacheService.setAtomic).toHaveBeenCalledTimes(5);
    expect(errorSpy).toHaveBeenCalled();
    expect((service as any).isRunning).toBe(false);
  });
});
