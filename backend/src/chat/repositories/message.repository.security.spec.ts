import { ForbiddenException } from "@nestjs/common";
import { MessageRepository } from "./message.repository";

describe("MessageRepository batch authorization", () => {
  it("rolls back before persistence when a queued sender is not a participant", async () => {
    const manager = {
      find: jest.fn().mockResolvedValue([
        {
          id: "conversation-1",
          user1Id: "user-1",
          user2Id: "user-2",
        },
      ]),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      manager,
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
    };
    const repository = {
      create: jest.fn(),
    };
    const dataSource = {
      createQueryRunner: jest.fn().mockReturnValue(queryRunner),
    };
    const messageRepository = new MessageRepository(
      repository as any,
      dataSource as any,
    );

    await expect(
      messageRepository.saveBatch([
        {
          id: "message-1",
          conversationId: "conversation-1",
          senderId: "attacker",
          content: "forged message",
          createdAt: new Date(),
          queuedAt: new Date(),
        },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(repository.create).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });
});
