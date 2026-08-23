import { ForbiddenException } from "@nestjs/common";
import { ChatService } from "./chat.service";

describe("ChatService message authorization", () => {
  const conversationRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const messageRepository = {
    create: jest.fn(),
  };
  const userBlockRepository = {
    findOne: jest.fn(),
  };
  const unifiedRedisService = {
    getSetMembers: jest.fn(),
    deleteCache: jest.fn(),
  };
  const queueService = {
    queueMessage: jest.fn(),
  };
  const usersService = {
    findOne: jest.fn(),
  };

  const createService = () =>
    new ChatService(
      conversationRepository as any,
      messageRepository as any,
      userBlockRepository as any,
      {} as any,
      unifiedRedisService as any,
      {} as any,
      {} as any,
      queueService as any,
      {} as any,
      usersService as any,
      {} as any,
    );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects a non-participant before queue or database side effects", async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: "conversation-1",
      user1Id: "user-1",
      user2Id: "user-2",
    });

    await expect(
      createService().sendMessage("attacker", {
        conversationId: "conversation-1",
        content: "forged message",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(queueService.queueMessage).not.toHaveBeenCalled();
    expect(conversationRepository.update).not.toHaveBeenCalled();
    expect(messageRepository.create).not.toHaveBeenCalled();
    expect(unifiedRedisService.getSetMembers).not.toHaveBeenCalled();
    expect(unifiedRedisService.deleteCache).not.toHaveBeenCalled();
    expect(userBlockRepository.findOne).not.toHaveBeenCalled();
  });

  it("rejects blocked participants before queue or database side effects", async () => {
    conversationRepository.findOne.mockResolvedValue({
      id: "conversation-1",
      user1Id: "user-1",
      user2Id: "user-2",
    });
    userBlockRepository.findOne.mockResolvedValue({
      blockerId: "user-2",
      blockedId: "user-1",
    });

    await expect(
      createService().sendMessage("user-1", {
        conversationId: "conversation-1",
        content: "blocked message",
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(queueService.queueMessage).not.toHaveBeenCalled();
    expect(conversationRepository.update).not.toHaveBeenCalled();
    expect(messageRepository.create).not.toHaveBeenCalled();
  });
});
