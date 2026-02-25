import { ViewCountService } from "./view-count.service";

describe("ViewCountService", () => {
  const createService = () => {
    const pipeline = {
      incrby: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };

    const redis = {
      set: jest.fn(),
      multi: jest.fn().mockReturnValue(pipeline),
    };

    const service = new ViewCountService(
      {} as any,
      {} as any,
      redis as any,
      {} as any,
    );

    return { service, redis, pipeline };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("buffers view when unique marker is newly created", async () => {
    const { service, redis, pipeline } = createService();
    redis.set.mockResolvedValue("OK");

    await service.incrementViewCount("post-1", "user-1", undefined);

    expect(redis.set).toHaveBeenCalledWith(
      "post:post-1:view:user:user-1",
      "1",
      "EX",
      60 * 60 * 24,
      "NX",
    );
    expect(redis.multi).toHaveBeenCalled();
    expect(pipeline.incrby).toHaveBeenCalledWith("post:view:buffer:post-1", 1);
    expect(pipeline.expire).toHaveBeenCalledWith(
      "post:view:buffer:post-1",
      300,
      "NX",
    );
    expect(pipeline.exec).toHaveBeenCalled();
  });

  it("skips buffering when unique marker already exists", async () => {
    const { service, redis, pipeline } = createService();
    redis.set.mockResolvedValue(null);

    await service.incrementViewCount("post-2", undefined, "viewer-abc");

    expect(redis.set).toHaveBeenCalledWith(
      "post:post-2:view:viewer:viewer-abc",
      "1",
      "EX",
      60 * 60 * 24,
      "NX",
    );
    expect(redis.multi).not.toHaveBeenCalled();
    expect(pipeline.exec).not.toHaveBeenCalled();
  });

  it("buffers view without dedupe key when user/viewer identifiers are absent", async () => {
    const { service, redis, pipeline } = createService();

    await service.incrementViewCount("post-3");

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.multi).toHaveBeenCalled();
    expect(pipeline.incrby).toHaveBeenCalledWith("post:view:buffer:post-3", 1);
  });
});
