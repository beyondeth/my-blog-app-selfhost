import { FeedCacheWarmingService } from "./feed-cache-warming.service";
import { FeedPeriodType, FeedSortType } from "./dto";

describe("FeedCacheWarmingService", () => {
  const originalDisableFeedWarming = process.env.DISABLE_FEED_WARMING;
  const originalDisableCommunityWarming =
    process.env.DISABLE_COMMUNITY_FEED_WARMING;
  const originalDisablePeriodWarming = process.env.DISABLE_FEED_PERIOD_WARMING;

  const mockFeedService = {
    getUnifiedFeed: jest.fn(),
  };
  const mockCommunityRepository = {
    find: jest.fn(),
  };
  const mockCommunityPostService = {
    findAll: jest.fn(),
  };

  let service: FeedCacheWarmingService;

  beforeEach(() => {
    service = new FeedCacheWarmingService(
      mockFeedService as any,
      mockCommunityRepository as any,
      mockCommunityPostService as any,
    );
    mockFeedService.getUnifiedFeed.mockResolvedValue({
      items: [],
      hasMore: false,
      nextCursor: null,
      count: 0,
    });
    mockCommunityRepository.find.mockResolvedValue([]);
    mockCommunityPostService.findAll.mockResolvedValue([]);
  });

  afterEach(() => {
    process.env.DISABLE_FEED_WARMING = originalDisableFeedWarming;
    process.env.DISABLE_COMMUNITY_FEED_WARMING =
      originalDisableCommunityWarming;
    process.env.DISABLE_FEED_PERIOD_WARMING = originalDisablePeriodWarming;
    jest.clearAllMocks();
  });

  it("warms base sorts and period hot/top combinations by default", async () => {
    delete process.env.DISABLE_FEED_PERIOD_WARMING;

    await (service as any).warmUnifiedFeed();

    const warmedKeys = mockFeedService.getUnifiedFeed.mock.calls.map(
      ([dto]: [{ sort: FeedSortType; period?: FeedPeriodType }]) =>
        `${dto.sort}:${dto.period ?? FeedPeriodType.ALL}`,
    );

    expect(mockFeedService.getUnifiedFeed).toHaveBeenCalledTimes(9);
    expect(warmedKeys).toEqual(
      expect.arrayContaining([
        `${FeedSortType.RECENT}:${FeedPeriodType.ALL}`,
        `${FeedSortType.HOT}:${FeedPeriodType.ALL}`,
        `${FeedSortType.TOP}:${FeedPeriodType.ALL}`,
        `${FeedSortType.HOT}:${FeedPeriodType.DAILY}`,
        `${FeedSortType.HOT}:${FeedPeriodType.WEEKLY}`,
        `${FeedSortType.HOT}:${FeedPeriodType.MONTHLY}`,
        `${FeedSortType.TOP}:${FeedPeriodType.DAILY}`,
        `${FeedSortType.TOP}:${FeedPeriodType.WEEKLY}`,
        `${FeedSortType.TOP}:${FeedPeriodType.MONTHLY}`,
      ]),
    );
  });

  it("skips period warming when DISABLE_FEED_PERIOD_WARMING=true", async () => {
    process.env.DISABLE_FEED_PERIOD_WARMING = "true";

    await (service as any).warmUnifiedFeed();

    const warmedKeys = mockFeedService.getUnifiedFeed.mock.calls.map(
      ([dto]: [{ sort: FeedSortType; period?: FeedPeriodType }]) =>
        `${dto.sort}:${dto.period ?? FeedPeriodType.ALL}`,
    );

    expect(mockFeedService.getUnifiedFeed).toHaveBeenCalledTimes(3);
    expect(warmedKeys).toEqual(
      expect.arrayContaining([
        `${FeedSortType.RECENT}:${FeedPeriodType.ALL}`,
        `${FeedSortType.HOT}:${FeedPeriodType.ALL}`,
        `${FeedSortType.TOP}:${FeedPeriodType.ALL}`,
      ]),
    );
  });

  it("does not run warm cycle when previous cycle is still in progress", async () => {
    (service as any).warmingInProgress = true;

    await service.warmAllFeeds();

    expect(mockFeedService.getUnifiedFeed).not.toHaveBeenCalled();
    expect(mockCommunityRepository.find).not.toHaveBeenCalled();
  });
});
