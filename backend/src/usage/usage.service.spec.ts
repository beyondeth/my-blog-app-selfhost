import { UsageService } from "./usage.service";
import { UsageTracking } from "./entities/usage-tracking.entity";
import { ResourceType } from "../common/enums/subscription.enum";

describe("UsageService (self-hosted v1)", () => {
  const createService = (usage: UsageTracking) => {
    const usageRepository = {
      findOne: jest.fn().mockResolvedValue(usage),
      save: jest.fn().mockResolvedValue(usage),
      create: jest.fn((value) => Object.assign(new UsageTracking(), value)),
    };
    const subscriptionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const redisCache = {
      getCache: jest.fn().mockResolvedValue(null),
      setCache: jest.fn().mockResolvedValue(undefined),
    };
    const service = new UsageService(
      usageRepository as any,
      subscriptionRepository as any,
      {} as any,
      {} as any,
      { on: jest.fn() } as any,
      redisCache as any,
      {} as any,
    );

    return { service, usageRepository };
  };

  it("does not apply a dormant subscription cap to MCP posts", async () => {
    const usage = Object.assign(new UsageTracking(), {
      userId: "user-1",
      resourceType: ResourceType.MCP_POST,
      count: 10_000,
      limit: -1,
      period: new Date(),
    });
    const { service } = createService(usage);

    await expect(service.checkMcpPostLimit("user-1")).resolves.toEqual({
      canPost: true,
    });
  });

  it("records MCP usage with an unlimited limit", async () => {
    const usage = Object.assign(new UsageTracking(), {
      userId: "user-1",
      resourceType: ResourceType.MCP_POST,
      count: 10_000,
      limit: -1,
      peakUsage: 10_000,
      warningsSent: 0,
      period: new Date(),
    });
    const { service, usageRepository } = createService(usage);

    await expect(service.trackMcpPost("user-1")).resolves.toBe(usage);
    expect(usage.limit).toBe(-1);
    expect(usage.count).toBe(10_001);
    expect(usageRepository.save).toHaveBeenCalled();
  });
});
