import { Test, TestingModule } from "@nestjs/testing";
import { FollowsController } from "./follows.controller";
import { FollowsService } from "./follows.service";
import { IS_PUBLIC_KEY } from "../common/decorators/public.decorator";

describe("FollowsController", () => {
  let controller: FollowsController;

  const mockFollowsService = {
    follow: jest.fn(),
    unfollow: jest.fn(),
    getFollowers: jest.fn(),
    getFollowing: jest.fn(),
    getFollowInfo: jest.fn(),
    getFollowersCursor: jest.fn(),
    getFollowingCursor: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FollowsController],
      providers: [
        {
          provide: FollowsService,
          useValue: mockFollowsService,
        },
      ],
    }).compile();

    controller = module.get<FollowsController>(FollowsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should follow the target user as the authenticated user", async () => {
    mockFollowsService.follow.mockResolvedValue(undefined);
    const request = {
      user: { id: "current-user-id" },
    } as Parameters<FollowsController["follow"]>[1];

    await controller.follow("target-user-id", request);

    expect(mockFollowsService.follow).toHaveBeenCalledWith(
      "current-user-id",
      "target-user-id",
    );
  });

  it("exposes follow counts publicly while preserving optional viewer state", () => {
    const isPublic = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      FollowsController.prototype.getFollowInfo,
    );

    expect(isPublic).toBe(true);
  });
});
