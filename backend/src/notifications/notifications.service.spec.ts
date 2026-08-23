import { Test, TestingModule } from "@nestjs/testing";
import { getRedisConnectionToken } from "@nestjs-modules/ioredis";
import { getRepositoryToken } from "@nestjs/typeorm";
import { NotificationsService } from "./notifications.service";
import { Notification, NotificationType } from "./entities/notification.entity";

describe("NotificationsService", () => {
  let service: NotificationsService;

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    delete: jest.fn(),
  };

  const mockRedis = {
    hget: jest.fn(),
    hset: jest.fn(),
    hincrby: jest.fn(),
    hdel: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.hget.mockResolvedValue(null);
    mockRedis.hset.mockResolvedValue(1);
    mockRedis.hincrby.mockResolvedValue(1);
    mockRedis.hdel.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRedisConnectionToken(),
          useValue: mockRedis,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should save a notification and increment the recipient unread count", async () => {
    const data = {
      recipientId: "recipient-id",
      issuerId: "issuer-id",
      type: NotificationType.FOLLOW,
    };
    const notification = { id: "notification-id", ...data } as Notification;
    mockNotificationRepository.create.mockReturnValue(notification);
    mockNotificationRepository.save.mockResolvedValue(notification);

    await expect(service.create(data)).resolves.toBe(notification);

    expect(mockNotificationRepository.create).toHaveBeenCalledWith(data);
    expect(mockNotificationRepository.save).toHaveBeenCalledWith(notification);
    expect(mockRedis.hincrby).toHaveBeenCalledWith(
      "notifications:unread",
      data.recipientId,
      1,
    );
  });

  it("should not create a notification for an action on oneself", async () => {
    await expect(
      service.create({
        recipientId: "same-user-id",
        issuerId: "same-user-id",
        type: NotificationType.FOLLOW,
      }),
    ).resolves.toBeNull();

    expect(mockNotificationRepository.create).not.toHaveBeenCalled();
    expect(mockRedis.hincrby).not.toHaveBeenCalled();
  });

  it("should return a valid unread count from Redis", async () => {
    mockRedis.hget.mockResolvedValue("7");

    await expect(service.getUnreadCount("user-id")).resolves.toBe(7);

    expect(mockNotificationRepository.count).not.toHaveBeenCalled();
  });

  it("should refresh and cache the unread count on a Redis miss", async () => {
    mockNotificationRepository.count.mockResolvedValue(3);

    await expect(service.getUnreadCount("user-id")).resolves.toBe(3);

    expect(mockNotificationRepository.count).toHaveBeenCalledWith({
      where: { recipientId: "user-id", read: false },
    });
    expect(mockRedis.hset).toHaveBeenCalledWith(
      "notifications:unread",
      "user-id",
      3,
    );
  });
});
