import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Interval, SchedulerRegistry } from "@nestjs/schedule";
import { ChatQueueService } from "./chat-queue.service";
import { MessageRepository } from "../repositories/message.repository";
import {
  BatchResult,
  QueuedMessage,
  QueueMetrics,
} from "../interfaces/message-queue.interface";
import {
  BatchConfig,
  DEFAULT_BATCH_CONFIG,
} from "../interfaces/batch-config.interface";
import { ChatMetricsService } from "../../metrics/chat-metrics.service";
import { RedisMonitoringService } from "../../redis/redis-monitoring.service";

@Injectable()
export class ChatBatchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatBatchService.name);
  private readonly config: BatchConfig;
  private isProcessing = false;
  private intervalHandle: NodeJS.Timeout;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private lastRedisConnectionStatus: boolean | null = null;

  constructor(
    private readonly queueService: ChatQueueService,
    private readonly messageRepository: MessageRepository,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly metricsService: ChatMetricsService,
    private readonly redisMonitoringService: RedisMonitoringService,
  ) {
    this.config = DEFAULT_BATCH_CONFIG;
  }

  async onModuleInit() {
    this.logger.log("ChatBatchService initialized");

    // Check and update Redis connection status
    await this.updateRedisConnectionStatus();

    // Start batch processing interval
    this.startBatchProcessing();

    // Process any pending messages from previous session
    await this.processInitialQueue();
  }

  async onModuleDestroy() {
    this.logger.log("ChatBatchService shutting down");

    // Stop interval
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    // Process remaining messages before shutdown
    await this.processBatch();
  }

  /**
   * Start batch processing interval
   */
  private startBatchProcessing() {
    this.intervalHandle = setInterval(async () => {
      // Check Redis connection status periodically
      await this.updateRedisConnectionStatus();

      // Process batch
      await this.processBatch();
    }, this.config.batchInterval);

    this.logger.log(
      `Batch processing started with ${this.config.batchInterval}ms interval`,
    );
  }

  /**
   * Process initial queue on startup
   */
  private async processInitialQueue() {
    try {
      const metrics = await this.queueService.getMetrics();

      // Prometheus 메트릭 업데이트
      this.metricsService.updateQueueMetrics(
        metrics.queueSize,
        metrics.dlqSize,
      );

      if (metrics.queueSize > 0) {
        this.logger.log(
          `Found ${metrics.queueSize} pending messages from previous session`,
        );
        await this.processBatch();
      }

      if (metrics.dlqSize > 0) {
        this.logger.warn(`Found ${metrics.dlqSize} messages in DLQ`);
        await this.recoverDeadLetterQueue();
      }
    } catch (error) {
      this.logger.error("Failed to process initial queue:", error);
    }
  }

  /**
   * Main batch processing function
   */
  async processBatch(): Promise<BatchResult> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      this.logger.debug("Batch processing already in progress, skipping");
      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        processingTime: 0,
        error: "Processing already in progress",
      };
    }

    this.isProcessing = true;
    this.metricsService.startBatchProcessing();
    const startTime = Date.now();

    try {
      // Get messages from queue
      const messages = await this.queueService.dequeueMessages(
        this.config.batchSize,
      );

      if (messages.length === 0) {
        const processingTime = Date.now() - startTime;
        this.metricsService.endBatchProcessing(processingTime, 0, 0, 0);
        return {
          success: true,
          processedCount: 0,
          failedCount: 0,
          processingTime,
        };
      }

      this.logger.debug(`Processing batch of ${messages.length} messages`);

      // 메시지 지연 시간 계산 및 기록
      messages.forEach((msg) => {
        if (msg.queuedAt) {
          const latency = Date.now() - new Date(msg.queuedAt).getTime();
          this.metricsService.recordMessageLatency(latency);
        }
      });

      // Save messages to database
      try {
        await this.messageRepository.saveBatch(messages);

        // Update metrics
        const processingTime = Date.now() - startTime;
        await this.queueService.updateMetrics(messages.length, processingTime);

        // Prometheus 메트릭 업데이트
        this.metricsService.endBatchProcessing(
          processingTime,
          messages.length,
          0,
          messages.length,
        );

        // Reset consecutive failures counter
        this.consecutiveFailures = 0;
        this.metricsService.updateConsecutiveFailures(0);

        this.logger.log(
          `Successfully processed ${messages.length} messages in ${processingTime}ms`,
        );

        // 큐 메트릭 업데이트
        const metrics = await this.queueService.getMetrics();
        this.metricsService.updateQueueMetrics(
          metrics.queueSize,
          metrics.dlqSize,
        );

        return {
          success: true,
          processedCount: messages.length,
          failedCount: 0,
          processingTime,
        };
      } catch (dbError) {
        this.logger.error("Failed to save messages to database:", dbError);

        // Move failed messages to DLQ if enabled
        if (this.config.dlqEnabled) {
          await this.queueService.moveToDeadLetterQueue(messages);
        } else {
          // Re-queue messages if DLQ is disabled
          for (const message of messages) {
            await this.queueService.queueMessage({
              conversationId: message.conversationId,
              senderId: message.senderId,
              content: message.content,
              tempId: message.tempId,
            });
          }
        }

        // Increment consecutive failures
        this.consecutiveFailures++;
        this.metricsService.updateConsecutiveFailures(this.consecutiveFailures);

        // Check if we should pause processing
        if (this.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          this.logger.error(
            `Reached ${this.MAX_CONSECUTIVE_FAILURES} consecutive failures, pausing batch processing`,
          );
          clearInterval(this.intervalHandle);
        }

        const processingTime = Date.now() - startTime;

        // Prometheus 메트릭 업데이트
        this.metricsService.endBatchProcessing(
          processingTime,
          0,
          messages.length,
          messages.length,
        );

        // 큐 메트릭 업데이트
        const metrics = await this.queueService.getMetrics();
        this.metricsService.updateQueueMetrics(
          metrics.queueSize,
          metrics.dlqSize,
        );

        return {
          success: false,
          processedCount: 0,
          failedCount: messages.length,
          failedMessages: messages,
          processingTime,
          error: dbError.message,
        };
      }
    } catch (error) {
      this.logger.error("Unexpected error in batch processing:", error);

      const processingTime = Date.now() - startTime;
      this.metricsService.endBatchProcessing(processingTime, 0, 0, 0);

      return {
        success: false,
        processedCount: 0,
        failedCount: 0,
        processingTime,
        error: error.message,
      };
    } finally {
      this.isProcessing = false;
      this.metricsService.processingStatus.set(0);
    }
  }

  /**
   * Process messages immediately (bypass interval)
   */
  async processImmediate(): Promise<BatchResult> {
    return this.processBatch();
  }

  /**
   * Recover messages from DLQ
   */
  async recoverDeadLetterQueue(limit: number = 10): Promise<number> {
    try {
      const messages =
        await this.queueService.recoverFromDeadLetterQueue(limit);
      this.logger.log(`Recovered ${messages.length} messages from DLQ`);
      return messages.length;
    } catch (error) {
      this.logger.error("Failed to recover DLQ messages:", error);
      return 0;
    }
  }

  /**
   * Get current queue metrics
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    return this.queueService.getMetrics();
  }

  /**
   * Check queue health
   */
  async checkHealth(): Promise<{
    healthy: boolean;
    queueSize: number;
    dlqSize: number;
    isProcessing: boolean;
    consecutiveFailures: number;
  }> {
    const metrics = await this.queueService.getMetrics();

    return {
      healthy: metrics.queueSize < 1000 && metrics.dlqSize < 100,
      queueSize: metrics.queueSize,
      dlqSize: metrics.dlqSize,
      isProcessing: this.isProcessing,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * Resume batch processing after pause
   */
  resumeProcessing() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
    }

    this.consecutiveFailures = 0;
    this.startBatchProcessing();

    this.logger.log("Batch processing resumed");
  }

  /**
   * Update batch configuration
   */
  updateConfig(newConfig: Partial<BatchConfig>) {
    Object.assign(this.config, newConfig);

    // Restart interval if batch interval changed
    if (newConfig.batchInterval) {
      if (this.intervalHandle) {
        clearInterval(this.intervalHandle);
      }
      this.startBatchProcessing();
    }

    this.logger.log("Batch configuration updated:", this.config);
  }

  /**
   * Update Redis connection status metric
   */
  private async updateRedisConnectionStatus(): Promise<void> {
    try {
      const isConnected = await this.redisMonitoringService.isConnected();
      this.metricsService.updateRedisConnectionStatus(isConnected);

      // Only log when connection status changes
      if (this.lastRedisConnectionStatus !== isConnected) {
        if (isConnected) {
          this.logger.log("Redis connection restored");
        } else {
          this.logger.warn("Redis connection lost");
        }
        this.lastRedisConnectionStatus = isConnected;
      }
    } catch (error) {
      this.logger.error("Failed to check Redis connection status:", error);
      this.metricsService.updateRedisConnectionStatus(false);
      this.lastRedisConnectionStatus = false;
    }
  }
}
