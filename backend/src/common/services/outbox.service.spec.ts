import { OutboxService } from "./outbox.service";
import {
  OutboxEvent,
  OutboxEventStatus,
} from "../entities/outbox-event.entity";

describe("OutboxService", () => {
  it("writes a pending event through the transaction manager", async () => {
    const eventRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(async (value) => value),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(eventRepository),
    };
    const service = new OutboxService({} as any, {} as any);

    await service.enqueue(manager as any, {
      eventType: "post.created",
      aggregateType: "post",
      aggregateId: "post-1",
      payload: { postId: "post-1" },
    });

    expect(eventRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "post.created",
        aggregateId: "post-1",
        organizationId: null,
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        maxAttempts: 10,
        dedupeKey: null,
        requestId: null,
        deadLetteredAt: null,
      }),
    );
    expect(eventRepository.save).toHaveBeenCalled();
  });

  it("claims and dispatches a pending event with tenant context", async () => {
    const staleRecoveryQuery = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const claimQuery = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const event: Partial<OutboxEvent> = {
      id: "event-1",
      eventType: "outbox.post.queue",
      aggregateType: "post",
      aggregateId: "post-1",
      organizationId: "org-1",
      payload: { postId: "post-1" },
      status: OutboxEventStatus.PENDING,
      attempts: 0,
      maxAttempts: 10,
      dedupeKey: null,
      requestId: "request-1",
      deadLetteredAt: null,
    };
    const repository = {
      find: jest.fn().mockResolvedValue([event]),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(staleRecoveryQuery)
        .mockReturnValueOnce(claimQuery),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue([]),
    };
    const service = new OutboxService(repository as any, eventEmitter as any);

    await service.dispatchPending();

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      "outbox.post.queue",
      expect.objectContaining({
        postId: "post-1",
        organizationId: "org-1",
        requestId: "request-1",
        outboxEventId: "event-1",
      }),
    );
    expect(repository.update).toHaveBeenCalledWith(
      { id: "event-1" },
      expect.objectContaining({
        status: OutboxEventStatus.PROCESSED,
        lockedAt: null,
      }),
    );
  });

  it("moves an event to dead-letter after the final attempt", async () => {
    const staleRecoveryQuery = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const claimQuery = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const event: Partial<OutboxEvent> = {
      id: "event-final",
      eventType: "outbox.post.queue",
      aggregateType: "post",
      aggregateId: "post-1",
      organizationId: "org-1",
      payload: { postId: "post-1" },
      status: OutboxEventStatus.FAILED,
      attempts: 2,
      maxAttempts: 3,
    };
    const repository = {
      find: jest.fn().mockResolvedValue([event]),
      createQueryBuilder: jest
        .fn()
        .mockReturnValueOnce(staleRecoveryQuery)
        .mockReturnValueOnce(claimQuery),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const eventEmitter = {
      emitAsync: jest.fn().mockRejectedValue(new Error("queue unavailable")),
    };
    const service = new OutboxService(repository as any, eventEmitter as any);

    await service.dispatchPending();

    expect(repository.update).toHaveBeenCalledWith(
      { id: "event-final" },
      expect.objectContaining({
        status: OutboxEventStatus.DEAD_LETTER,
        deadLetteredAt: expect.any(Date),
        lockedAt: null,
      }),
    );
  });
});
