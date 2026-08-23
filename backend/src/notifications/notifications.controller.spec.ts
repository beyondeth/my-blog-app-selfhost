import { Test, TestingModule } from "@nestjs/testing";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

describe("NotificationsController", () => {
  let controller: NotificationsController;

  const mockNotificationsService = {
    getNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    markAllAsRead: jest.fn(),
    delete: jest.fn(),
    deleteAll: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  it("should request the authenticated user's notifications", async () => {
    const response = {
      data: [],
      total: 0,
      page: 2,
      limit: 10,
      totalPages: 0,
    };
    mockNotificationsService.getNotifications.mockResolvedValue(response);

    await expect(
      controller.getNotifications({ user: { id: "user-id" } }, 2, 10),
    ).resolves.toBe(response);

    expect(mockNotificationsService.getNotifications).toHaveBeenCalledWith(
      "user-id",
      2,
      10,
    );
  });

  it("should wrap the authenticated user's unread count", async () => {
    mockNotificationsService.getUnreadCount.mockResolvedValue(4);

    await expect(
      controller.getUnreadCount({ user: { id: "user-id" } }),
    ).resolves.toEqual({ count: 4 });
  });
});
