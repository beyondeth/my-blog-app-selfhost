import { SchedulerRegistry } from "@nestjs/schedule";
import { Test, TestingModule } from "@nestjs/testing";
import { ChatMetricsService } from "../../metrics/chat-metrics.service";
import { RedisMonitoringService } from "../../redis/redis-monitoring.service";
import { MessageRepository } from "../repositories/message.repository";
import { ChatBatchService } from "./chat-batch.service";
import { ChatQueueService } from "./chat-queue.service";

describe("ChatBatchService", () => {
  let service: ChatBatchService;
  let queueService: jest.Mocked<ChatQueueService>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let metricsService: jest.Mocked<ChatMetricsService>;
  let redisMonitoringService: jest.Mocked<RedisMonitoringService>;

  const emptyMetrics = {
    queueSize: 0,
    dlqSize: 0,
    processingRate: 0,
    averageProcessingTime: 0,
    failureRate: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatBatchService,
        {
          provide: ChatQueueService,
          useValue: {
            dequeueMessages: jest.fn().mockResolvedValue([]),
            moveToDeadLetterQueue: jest.fn(),
            queueMessage: jest.fn(),
            updateMetrics: jest.fn(),
            getMetrics: jest.fn().mockResolvedValue(emptyMetrics),
            recoverFromDeadLetterQueue: jest.fn(),
          },
        },
        {
          provide: MessageRepository,
          useValue: {
            saveBatch: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {},
        },
        {
          provide: ChatMetricsService,
          useValue: {
            startBatchProcessing: jest.fn(),
            endBatchProcessing: jest.fn(),
            recordMessageLatency: jest.fn(),
            updateConsecutiveFailures: jest.fn(),
            updateQueueMetrics: jest.fn(),
            updateRedisConnectionStatus: jest.fn(),
            processingStatus: { set: jest.fn() },
          },
        },
        {
          provide: RedisMonitoringService,
          useValue: {
            isConnected: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(ChatBatchService);
    queueService = module.get(ChatQueueService);
    messageRepository = module.get(MessageRepository);
    metricsService = module.get(ChatMetricsService);
    redisMonitoringService = module.get(RedisMonitoringService);
  });

  it("persists an authorized batch and records success metrics", async () => {
    const messages = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Hello",
        createdAt: new Date(),
        queuedAt: new Date(),
      },
      {
        id: "msg-2",
        conversationId: "conv-2",
        senderId: "user-2",
        content: "Hi",
        createdAt: new Date(),
        queuedAt: new Date(),
      },
    ];
    queueService.dequeueMessages.mockResolvedValue(messages);
    messageRepository.saveBatch.mockResolvedValue([]);

    const result = await service.processBatch();

    expect(result).toMatchObject({
      success: true,
      processedCount: 2,
      failedCount: 0,
    });
    expect(queueService.dequeueMessages).toHaveBeenCalledWith(100);
    expect(messageRepository.saveBatch).toHaveBeenCalledTimes(1);
    expect(messageRepository.saveBatch).toHaveBeenCalledWith(messages);
    expect(queueService.updateMetrics).toHaveBeenCalledWith(
      2,
      expect.any(Number),
    );
    expect(metricsService.endBatchProcessing).toHaveBeenCalledWith(
      expect.any(Number),
      2,
      0,
      2,
    );
    expect(metricsService.processingStatus.set).toHaveBeenCalledWith(0);
  });

  it("does not access the repository for an empty queue", async () => {
    queueService.dequeueMessages.mockResolvedValue([]);

    await expect(service.processBatch()).resolves.toMatchObject({
      success: true,
      processedCount: 0,
      failedCount: 0,
    });

    expect(messageRepository.saveBatch).not.toHaveBeenCalled();
    expect(metricsService.endBatchProcessing).toHaveBeenCalledWith(
      expect.any(Number),
      0,
      0,
      0,
    );
  });

  it("moves a failed batch to the DLQ and records failure metrics", async () => {
    const messages = [
      {
        id: "msg-1",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Hello",
        createdAt: new Date(),
        queuedAt: new Date(),
      },
    ];
    queueService.dequeueMessages.mockResolvedValue(messages);
    messageRepository.saveBatch.mockRejectedValue(new Error("Database error"));

    await expect(service.processBatch()).resolves.toMatchObject({
      success: false,
      processedCount: 0,
      failedCount: 1,
      failedMessages: messages,
      error: "Database error",
    });

    expect(queueService.moveToDeadLetterQueue).toHaveBeenCalledWith(messages);
    expect(metricsService.updateConsecutiveFailures).toHaveBeenCalledWith(1);
    expect(metricsService.endBatchProcessing).toHaveBeenCalledWith(
      expect.any(Number),
      0,
      1,
      1,
    );
  });

  it("processImmediate delegates to processBatch", async () => {
    const processBatch = jest.spyOn(service, "processBatch").mockResolvedValue({
      success: true,
      processedCount: 5,
      failedCount: 0,
      processingTime: 100,
    });

    await expect(service.processImmediate()).resolves.toMatchObject({
      processedCount: 5,
    });
    expect(processBatch).toHaveBeenCalledTimes(1);
  });

  it("recovers messages from the DLQ", async () => {
    queueService.recoverFromDeadLetterQueue.mockResolvedValue([
      {
        id: "dead-1",
        conversationId: "conv-1",
        senderId: "user-1",
        content: "Failed message",
        createdAt: new Date(),
        queuedAt: new Date(),
      },
    ]);

    await expect(service.recoverDeadLetterQueue(10)).resolves.toBe(1);
    expect(queueService.recoverFromDeadLetterQueue).toHaveBeenCalledWith(10);
  });

  it.each([
    { queueSize: 50, dlqSize: 1, healthy: true },
    { queueSize: 999, dlqSize: 99, healthy: true },
    { queueSize: 1000, dlqSize: 0, healthy: false },
    { queueSize: 0, dlqSize: 100, healthy: false },
  ])(
    "reports queueSize=$queueSize and dlqSize=$dlqSize as healthy=$healthy",
    async ({ queueSize, dlqSize, healthy }) => {
      queueService.getMetrics.mockResolvedValue({
        ...emptyMetrics,
        queueSize,
        dlqSize,
      });

      await expect(service.checkHealth()).resolves.toMatchObject({
        healthy,
        queueSize,
        dlqSize,
      });
    },
  );

  it("checks Redis and pending queue state on module initialization", async () => {
    jest.useFakeTimers();

    try {
      await service.onModuleInit();

      expect(redisMonitoringService.isConnected).toHaveBeenCalledTimes(1);
      expect(metricsService.updateRedisConnectionStatus).toHaveBeenCalledWith(
        true,
      );
      expect(queueService.getMetrics).toHaveBeenCalled();
    } finally {
      await service.onModuleDestroy();
      jest.useRealTimers();
    }
  });
});
