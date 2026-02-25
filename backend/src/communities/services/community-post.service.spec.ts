import { NotFoundException } from "@nestjs/common";
import { CommunityPostService } from "./community-post.service";

describe("CommunityPostService", () => {
  const createService = () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };

    const postRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };

    const redisLockService = {
      acquireLock: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      releaseLock: jest.fn(),
    };

    const communityPostViewService = {
      bufferView: jest.fn(),
    };

    const service = new CommunityPostService(
      {} as any,
      postRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      redisLockService as any,
      communityPostViewService as any,
    );

    return {
      service,
      postRepository,
      queryBuilder,
      redisLockService,
      communityPostViewService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("buffers community view once for new user marker", async () => {
    const {
      service,
      queryBuilder,
      redisLockService,
      communityPostViewService,
    } = createService();

    queryBuilder.getOne.mockResolvedValue({ id: "post-1" });
    redisLockService.acquireLock.mockResolvedValue("lock-1");
    redisLockService.get.mockResolvedValue(null);
    redisLockService.set.mockResolvedValue(true);

    await service.incrementPostView("community-a", "post-1", "user-1");

    expect(redisLockService.set).toHaveBeenCalledWith(
      "community:post:post-1:view:user:user-1",
      "1",
      86400,
    );
    expect(communityPostViewService.bufferView).toHaveBeenCalledWith("post-1");
    expect(redisLockService.releaseLock).toHaveBeenCalledWith(
      "community:view:lock:post-1",
      "lock-1",
    );
  });

  it("skips buffering when anonymous viewer already counted", async () => {
    const {
      service,
      queryBuilder,
      redisLockService,
      communityPostViewService,
    } = createService();

    queryBuilder.getOne.mockResolvedValue({ id: "post-2" });
    redisLockService.acquireLock.mockResolvedValue("lock-2");
    redisLockService.get.mockResolvedValue("1");

    await service.incrementPostView(
      "community-a",
      "post-2",
      undefined,
      "viewer-123",
    );

    expect(redisLockService.get).toHaveBeenCalledWith(
      "community:post:post-2:view:viewer:viewer-123",
    );
    expect(communityPostViewService.bufferView).not.toHaveBeenCalled();
  });

  it("throws NotFoundException when post does not exist in target community", async () => {
    const { service, queryBuilder } = createService();
    queryBuilder.getOne.mockResolvedValue(null);

    await expect(
      service.incrementPostView("community-a", "missing-post", "user-1"),
    ).rejects.toThrow(NotFoundException);
  });
});
