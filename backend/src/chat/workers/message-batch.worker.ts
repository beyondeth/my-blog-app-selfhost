import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { MessageRepository } from '../repositories/message.repository';
import { ChatQueueService } from '../services/chat-queue.service';
import { QueuedMessage } from '../interfaces/message-queue.interface';

export const CHAT_QUEUE_NAME = 'chat-messages';

export interface MessageJobData {
  messages: QueuedMessage[];
  timestamp: number;
  retryCount?: number;
}

@Processor(CHAT_QUEUE_NAME)
@Injectable()
export class MessageBatchWorker extends WorkerHost {
  private readonly logger = new Logger(MessageBatchWorker.name);

  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly queueService: ChatQueueService,
  ) {
    super();
  }

  async process(job: Job<MessageJobData>): Promise<any> {
    const { messages, timestamp, retryCount = 0 } = job.data;

    this.logger.debug(`Processing job ${job.id} with ${messages.length} messages`);

    try {
      // Save messages to database in batch
      const savedMessages = await this.messageRepository.saveBatch(messages);

      // Clear processed messages from Redis cache
      await this.queueService.clearProcessedMessages(
        messages.map((m) => m.id),
      );

      // Update metrics
      const processingTime = Date.now() - timestamp;
      await this.queueService.updateMetrics(messages.length, processingTime);

      this.logger.log(
        `Job ${job.id} completed: ${savedMessages.length} messages saved in ${processingTime}ms`,
      );

      return {
        success: true,
        processedCount: savedMessages.length,
        processingTime,
      };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);

      // Check if we should retry
      if (retryCount < 3) {
        throw error; // BullMQ will handle retry
      }

      // Move to DLQ after max retries
      await this.queueService.moveToDeadLetterQueue(messages);

      return {
        success: false,
        error: error.message,
        movedToDLQ: true,
      };
    }
  }

  /**
   * Handle job failure
   */
  async onFailed(job: Job<MessageJobData>, error: Error) {
    this.logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts:`, error);

    // Update retry count in job data
    job.data.retryCount = (job.data.retryCount || 0) + 1;

    // Alert if too many failures
    if (job.attemptsMade >= 3) {
      this.logger.error(`Job ${job.id} failed permanently, messages moved to DLQ`);
      // Here you could send alerts, emails, etc.
    }
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job<MessageJobData>) {
    this.logger.debug(`Job ${job.id} completed successfully`);
  }

  /**
   * Handle job progress
   */
  async onProgress(job: Job<MessageJobData>, progress: number | object) {
    this.logger.debug(`Job ${job.id} progress:`, progress);
  }
}