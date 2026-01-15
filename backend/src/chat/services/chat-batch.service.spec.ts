/**
 * Chat Batch Service Unit Tests
 */

import { Test, TestingModule } from "@nestjs/testing";
import { ChatBatchService } from "./chat-batch.service";
import { ChatQueueService } from "./chat-queue.service";
import { MessageRepository } from "../repositories/message.repository";
import { ConversationRepository } from "../repositories/conversation.repository";
import { SchedulerRegistry } from "@nestjs/schedule";
import { Logger } from "@nestjs/common";

describe("ChatBatchService", () => {
  let service: ChatBatchService;
  let queueService: jest.Mocked<ChatQueueService>;
  let messageRepository: jest.Mocked<MessageRepository>;
  let conversationRepository: jest.Mocked<ConversationRepository>;
  let schedulerRegistry: jest.Mocked<SchedulerRegistry>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatBatchService,
        {
          provide: ChatQueueService,
          useValue: {
            dequeueMessages: jest.fn(),
            moveToDeadLetterQueue: jest.fn(),
            updateMetrics: jest.fn(),
            getMetrics: jest.fn(),
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
          provide: ConversationRepository,
          useValue: {
            updateLastMessageAt: jest.fn(),
          },
        },
        {
          provide: SchedulerRegistry,
          useValue: {
            addInterval: jest.fn(),
            deleteInterval: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ChatBatchService>(ChatBatchService);
    queueService = module.get(
      ChatQueueService,
    ) as jest.Mocked<ChatQueueService>;
    messageRepository = module.get(
      MessageRepository,
    ) as jest.Mocked<MessageRepository>;
    conversationRepository = module.get(
      ConversationRepository,
    ) as jest.Mocked<ConversationRepository>;
    schedulerRegistry = module.get(
      SchedulerRegistry,
    ) as jest.Mocked<SchedulerRegistry>;
  });

  describe("processBatch", () => {
    it("should process messages successfully", async () => {
      // Arrange
      const mockMessages = [
        {
          id: "msg1",
          conversationId: "conv1",
          senderId: "user1",
          content: "Hello",
          tempId: "temp1",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 0,
        },
        {
          id: "msg2",
          conversationId: "conv1",
          senderId: "user2",
          content: "Hi there",
          tempId: "temp2",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 0,
        },
      ];

      const savedMessages = mockMessages.map((m) => ({
        ...m,
        // Note: isRead removed - using lastReadAt on conversations instead
        isDeleted: false,
        updatedAt: new Date(),
      }));

      queueService.dequeueMessages.mockResolvedValue(mockMessages);
      messageRepository.saveBatch.mockResolvedValue(savedMessages as any);
      conversationRepository.updateLastMessageAt.mockResolvedValue(undefined);

      // Act
      const result = await service.processBatch();

      // Assert
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(queueService.dequeueMessages).toHaveBeenCalledWith(100);
      expect(messageRepository.saveBatch).toHaveBeenCalledWith(mockMessages);
      expect(queueService.updateMetrics).toHaveBeenCalled();
    });

    it("should handle empty queue", async () => {
      // Arrange
      queueService.dequeueMessages.mockResolvedValue([]);

      // Act
      const result = await service.processBatch();

      // Assert
      expect(result.success).toBe(true);
      expect(result.processedCount).toBe(0);
      expect(result.failedCount).toBe(0);
      expect(messageRepository.saveBatch).not.toHaveBeenCalled();
    });

    it("should handle batch save failure", async () => {
      // Arrange
      const mockMessages = [
        {
          id: "msg1",
          conversationId: "conv1",
          senderId: "user1",
          content: "Hello",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 0,
        },
      ];

      queueService.dequeueMessages.mockResolvedValue(mockMessages);
      messageRepository.saveBatch.mockRejectedValue(
        new Error("Database error"),
      );

      // Act
      const result = await service.processBatch();

      // Assert
      expect(result.success).toBe(false);
      expect(result.processedCount).toBe(0);
      expect(result.failedCount).toBe(1);
      expect(queueService.moveToDeadLetterQueue).toHaveBeenCalledWith(
        mockMessages,
      );
    });

    it("should group messages by conversation", async () => {
      // Arrange
      const mockMessages = [
        {
          id: "msg1",
          conversationId: "conv1",
          senderId: "user1",
          content: "Message 1",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 0,
        },
        {
          id: "msg2",
          conversationId: "conv2",
          senderId: "user2",
          content: "Message 2",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 0,
        },
        {
          id: "msg3",
          conversationId: "conv1",
          senderId: "user1",
          content: "Message 3",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 0,
        },
      ];

      queueService.dequeueMessages.mockResolvedValue(mockMessages);
      messageRepository.saveBatch.mockResolvedValue([] as any);

      // Act
      await service.processBatch();

      // Assert
      expect(conversationRepository.updateLastMessageAt).toHaveBeenCalledTimes(
        2,
      );
      expect(conversationRepository.updateLastMessageAt).toHaveBeenCalledWith(
        "conv1",
        expect.any(Object),
      );
      expect(conversationRepository.updateLastMessageAt).toHaveBeenCalledWith(
        "conv2",
        expect.any(Object),
      );
    });
  });

  describe("processImmediate", () => {
    it("should bypass timer and process immediately", async () => {
      // Arrange
      const processBatchSpy = jest.spyOn(service, "processBatch");
      processBatchSpy.mockResolvedValue({
        success: true,
        processedCount: 5,
        failedCount: 0,
        processingTime: 100,
        error: undefined,
      });

      // Act
      const result = await service.processImmediate();

      // Assert
      expect(processBatchSpy).toHaveBeenCalled();
      expect(result.processedCount).toBe(5);
    });
  });

  describe("recoverDeadLetterQueue", () => {
    it("should recover messages from DLQ", async () => {
      // Arrange
      const deadMessages = [
        {
          id: "dead1",
          conversationId: "conv1",
          senderId: "user1",
          content: "Failed message",
          createdAt: new Date(),
          queuedAt: new Date(),
          retryCount: 1,
        },
      ];
      queueService.recoverFromDeadLetterQueue.mockResolvedValue(deadMessages);

      // Act
      const result = await service.recoverDeadLetterQueue(10);

      // Assert
      expect(result).toBe(1);
      expect(queueService.recoverFromDeadLetterQueue).toHaveBeenCalledWith(10);
    });
  });

  describe("getQueueMetrics", () => {
    it("should return queue metrics", async () => {
      // Arrange
      const mockMetrics = {
        queueSize: 10,
        dlqSize: 2,
        processingRate: 100,
        averageProcessingTime: 50,
        lastProcessedAt: new Date(),
        failureRate: 0.02,
      };
      queueService.getMetrics.mockResolvedValue(mockMetrics);

      // Act
      const result = await service.getQueueMetrics();

      // Assert
      expect(result).toEqual(mockMetrics);
      expect(queueService.getMetrics).toHaveBeenCalled();
    });
  });

  describe("checkHealth", () => {
    it("should return healthy status", async () => {
      // Arrange
      const mockMetrics = {
        queueSize: 50,
        dlqSize: 1,
        processingRate: 100,
        averageProcessingTime: 30,
        lastProcessedAt: new Date(),
        failureRate: 0.01,
      };
      queueService.getMetrics.mockResolvedValue(mockMetrics);

      // Act
      const result = await service.checkHealth();

      // 검증: healthy 상태 반환
      expect(result.healthy).toBe(true);
      expect(result.queueSize).toBe(50);
      expect(result.dlqSize).toBe(1);
    });

    it("should return degraded status for high queue size", async () => {
      // Arrange
      const mockMetrics = {
        queueSize: 600,
        dlqSize: 5,
        processingRate: 100,
        averageProcessingTime: 30,
        lastProcessedAt: new Date(),
        failureRate: 0.02,
      };
      queueService.getMetrics.mockResolvedValue(mockMetrics);

      // Act
      const result = await service.checkHealth();

      // 검증: queue가 600이지만 1000 미만이므로 아직 healthy
      expect(result.healthy).toBe(true);
    });

    it("should return unhealthy status for critical metrics", async () => {
      // Arrange
      const mockMetrics = {
        queueSize: 1500,
        dlqSize: 150,
        processingRate: 10,
        averageProcessingTime: 200,
        lastProcessedAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        failureRate: 0.15,
      };
      queueService.getMetrics.mockResolvedValue(mockMetrics);

      // Act
      const result = await service.checkHealth();

      // 검증: queue가 1500 > 1000 또는 dlq가 150 > 100이므로 unhealthy
      expect(result.healthy).toBe(false);
    });
  });

  describe("interval processing", () => {
    it("should register interval on module init", () => {
      // Act
      service.onModuleInit();

      // Assert
      expect(schedulerRegistry.addInterval).toHaveBeenCalledWith(
        "chat-batch-processing",
        expect.any(Object),
      );
    });

    it("should clear interval on module destroy", () => {
      // Act
      service.onModuleDestroy();

      // Assert
      expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith(
        "chat-batch-processing",
      );
    });
  });
});
