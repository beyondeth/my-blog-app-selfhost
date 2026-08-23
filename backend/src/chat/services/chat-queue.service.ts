import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import {
  QueuedMessage,
  RedisMessageData,
  QueueMetrics,
} from "../interfaces/message-queue.interface";

@Injectable()
export class ChatQueueService {
  private readonly logger = new Logger(ChatQueueService.name);

  /**
   * 큐 키 구조
   * - 샤드별 큐: 부하 분산으로 병목현상 해결
   * - 단순한 라운드로빈 분배
   */
  private readonly QUEUE_SHARDS = 4; // 샤드 개수
  private readonly QUEUE_KEYS = {
    // 샤드별 큐 (0~3)
    SHARDS: Array.from({ length: 4 }, (_, i) => `chat:queue:shard:${i}`),
    // 기본 큐 (하위 호환성용)
    DEFAULT: "chat:queue:messages",
  };

  private readonly DLQ_KEY = "chat:queue:dlq";
  private readonly MESSAGE_PREFIX = "chat:msg:";
  private readonly CONVERSATION_PREFIX = "chat:conv:";
  private readonly METRICS_KEY = "chat:metrics";

  // 샤드 선택을 위한 라운드 로빈 카운터
  private shardCounter = 0;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Add message to queue and Redis cache
   * @description 메시지를 샤드별로 분산하여 병목현상 해결
   */
  async queueMessage(message: {
    conversationId: string;
    senderId: string;
    content: string;
    tempId?: string;
  }): Promise<QueuedMessage> {
    const messageId = uuidv4();
    const now = new Date();

    const queuedMessage: QueuedMessage = {
      id: messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      tempId: message.tempId,
      createdAt: now,
      queuedAt: now,
      retryCount: 0,
    };

    const redisData: RedisMessageData = {
      id: messageId,
      conversationId: message.conversationId,
      senderId: message.senderId,
      content: message.content,
      createdAt: now.toISOString(),
      tempId: message.tempId,
    };

    const pipeline = this.redis.pipeline();

    // Store message data
    pipeline.hset(
      `${this.MESSAGE_PREFIX}${messageId}`,
      this.objectToHash(redisData),
    );

    // Add to conversation sorted set (for quick retrieval)
    pipeline.zadd(
      `${this.CONVERSATION_PREFIX}${message.conversationId}`,
      now.getTime(),
      messageId,
    );

    /**
     * 단순 라운드로빈 분배
     * - 샤드별로 균등하게 분산
     */
    const shardIndex = this.shardCounter % this.QUEUE_SHARDS;
    const selectedQueue = this.QUEUE_KEYS.SHARDS[shardIndex];
    this.shardCounter++;

    pipeline.lpush(selectedQueue, JSON.stringify(queuedMessage));

    // Set TTL for message data (24 hours)
    pipeline.expire(`${this.MESSAGE_PREFIX}${messageId}`, 86400);

    // Update metrics
    pipeline.hincrby(this.METRICS_KEY, "totalQueued", 1);

    await pipeline.exec();

    this.logger.debug(`Message queued: ${messageId}`);
    return queuedMessage;
  }

  /**
   * Get messages from queue for batch processing
   * @description 모든 큐에서 메시지를 수집하여 배치 처리
   */
  async dequeueMessages(batchSize: number): Promise<QueuedMessage[]> {
    const messages: QueuedMessage[] = [];
    let remainingBatch = batchSize;

    /**
     * 샤드별로 메시지 수집
     * - 각 샤드에서 균등하게 가져와서 공정성 보장
     */
    const messagesPerShard = Math.ceil(
      remainingBatch / this.QUEUE_KEYS.SHARDS.length,
    );

    for (const shardKey of this.QUEUE_KEYS.SHARDS) {
      if (remainingBatch <= 0) break;

      const shardMessages = await this.dequeueFromQueue(
        shardKey,
        Math.min(messagesPerShard, remainingBatch),
      );
      messages.push(...shardMessages);
      remainingBatch -= shardMessages.length;
    }

    /**
     * 하위 호환성: 기존 큐에서도 확인
     * - 마이그레이션 중 누락 방지
     */
    if (remainingBatch > 0) {
      const defaultMessages = await this.dequeueFromQueue(
        this.QUEUE_KEYS.DEFAULT,
        remainingBatch,
      );
      messages.push(...defaultMessages);
    }

    if (messages.length > 0) {
      this.logger.debug(`[큐 처리] ${messages.length}개 메시지 수집 완료`);
    }

    return messages;
  }

  /**
   * 특정 큐에서 메시지 가져오기
   * @param queueKey 큐 키
   * @param count 가져올 개수
   * @returns 메시지 배열
   */
  private async dequeueFromQueue(
    queueKey: string,
    count: number,
  ): Promise<QueuedMessage[]> {
    const messages: QueuedMessage[] = [];

    if (count <= 0) return messages;

    // 파이프라인으로 한번에 처리 (네트워크 오버헤드 감소)
    const pipeline = this.redis.pipeline();
    for (let i = 0; i < count; i++) {
      pipeline.rpop(queueKey);
    }

    const results = await pipeline.exec();

    for (const [err, data] of results) {
      if (!err && data) {
        try {
          const message = JSON.parse(data as string);
          messages.push(message);
        } catch (parseError) {
          this.logger.error(`[큐 파싱 오류] ${queueKey}:`, parseError);
          // 파싱 실패한 메시지는 DLQ로
          await this.redis.lpush(this.DLQ_KEY, data as string);
        }
      }
    }

    return messages;
  }

  /**
   * Move failed messages to DLQ
   */
  async moveToDeadLetterQueue(messages: QueuedMessage[]): Promise<void> {
    if (messages.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const message of messages) {
      message.retryCount = (message.retryCount || 0) + 1;
      pipeline.lpush(this.DLQ_KEY, JSON.stringify(message));
    }

    // Update metrics
    pipeline.hincrby(this.METRICS_KEY, "totalFailed", messages.length);

    await pipeline.exec();

    this.logger.warn(`Moved ${messages.length} messages to DLQ`);
  }

  /**
   * Get messages from Redis cache
   */
  async getCachedMessages(
    conversationId: string,
    limit: number = 20,
  ): Promise<RedisMessageData[]> {
    // Get message IDs from conversation sorted set
    const messageIds = await this.redis.zrevrange(
      `${this.CONVERSATION_PREFIX}${conversationId}`,
      0,
      limit - 1,
    );

    if (messageIds.length === 0) {
      return [];
    }

    // Get message data for each ID
    const pipeline = this.redis.pipeline();
    for (const id of messageIds) {
      pipeline.hgetall(`${this.MESSAGE_PREFIX}${id}`);
    }

    const results = await pipeline.exec();
    const messages: RedisMessageData[] = [];

    for (const [err, data] of results) {
      if (!err && data && Object.keys(data).length > 0) {
        messages.push(data as RedisMessageData);
      }
    }

    return messages;
  }

  /**
   * Cache messages from database
   */
  async cacheMessages(messages: RedisMessageData[]): Promise<void> {
    if (messages.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const message of messages) {
      // Store message data
      pipeline.hset(
        `${this.MESSAGE_PREFIX}${message.id}`,
        this.objectToHash(message),
      );

      // Add to conversation sorted set
      pipeline.zadd(
        `${this.CONVERSATION_PREFIX}${message.conversationId}`,
        new Date(message.createdAt).getTime(),
        message.id,
      );

      // Set TTL (24 hours)
      pipeline.expire(`${this.MESSAGE_PREFIX}${message.id}`, 86400);
    }

    await pipeline.exec();
  }

  /**
   * Clear processed messages from cache
   */
  async clearProcessedMessages(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const id of messageIds) {
      pipeline.del(`${this.MESSAGE_PREFIX}${id}`);
    }

    await pipeline.exec();
  }

  /**
   * Get queue metrics
   * @description 모든 큐의 메트릭을 종합하여 제공
   */
  async getMetrics(): Promise<QueueMetrics> {
    /**
     * 모든 큐 크기 수집
     * - 샤드별 큐 크기
     * - 기본 큐 크기 (하위 호환)
     */
    const allQueues = [...this.QUEUE_KEYS.SHARDS, this.QUEUE_KEYS.DEFAULT];

    const queueSizes = await Promise.all(
      allQueues.map((key) => this.redis.llen(key)),
    );

    const totalQueueSize = queueSizes.reduce((sum, size) => sum + size, 0);

    const [dlqSize, metrics] = await Promise.all([
      this.redis.llen(this.DLQ_KEY),
      this.redis.hgetall(this.METRICS_KEY),
    ]);

    // 큐별 상태 로깅 (디버깅용)
    if (totalQueueSize > 100) {
      this.logger.debug(
        `[큐 상태] 총: ${totalQueueSize}, ` +
          `샤드별: ${this.QUEUE_KEYS.SHARDS.map((key, i) => `S${i}:${queueSizes[i]}`).join(", ")}`,
      );
    }

    const totalQueued = parseInt(metrics.totalQueued || "0", 10);
    const totalProcessed = parseInt(metrics.totalProcessed || "0", 10);
    const totalFailed = parseInt(metrics.totalFailed || "0", 10);
    const totalProcessingTime = parseFloat(metrics.totalProcessingTime || "0");

    return {
      queueSize: totalQueueSize,
      dlqSize,
      processingRate:
        totalProcessed > 0 ? totalProcessed / (Date.now() / 1000) : 0,
      averageProcessingTime:
        totalProcessed > 0 ? totalProcessingTime / totalProcessed : 0,
      lastProcessedAt: metrics.lastProcessedAt
        ? new Date(metrics.lastProcessedAt)
        : undefined,
      failureRate: totalQueued > 0 ? totalFailed / totalQueued : 0,
    };
  }

  /**
   * Update processing metrics
   */
  async updateMetrics(
    processedCount: number,
    processingTime: number,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    pipeline.hincrby(this.METRICS_KEY, "totalProcessed", processedCount);
    pipeline.hincrbyfloat(
      this.METRICS_KEY,
      "totalProcessingTime",
      processingTime,
    );
    pipeline.hset(
      this.METRICS_KEY,
      "lastProcessedAt",
      new Date().toISOString(),
    );

    await pipeline.exec();
  }

  /**
   * Recover messages from DLQ
   */
  async recoverFromDeadLetterQueue(
    limit: number = 10,
  ): Promise<QueuedMessage[]> {
    const messages: QueuedMessage[] = [];

    for (let i = 0; i < limit; i++) {
      const data = await this.redis.rpop(this.DLQ_KEY);
      if (!data) break;

      try {
        const message = JSON.parse(data);
        messages.push(message);
      } catch (error) {
        this.logger.error("Failed to parse DLQ message:", error);
      }
    }

    if (messages.length > 0) {
      // Re-queue messages
      const pipeline = this.redis.pipeline();
      for (const message of messages) {
        pipeline.lpush(this.QUEUE_KEYS.DEFAULT, JSON.stringify(message));
      }
      await pipeline.exec();

      this.logger.log(`Recovered ${messages.length} messages from DLQ`);
    }

    return messages;
  }

  /**
   * Get queue health status
   * @description 큐 시스템의 건강 상태를 확인
   */
  async getQueueHealth(): Promise<{
    healthy: boolean;
    totalSize: number;
    distribution: Record<string, number>;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    const distribution: Record<string, number> = {};

    // 각 큐 크기 확인
    for (const shardKey of this.QUEUE_KEYS.SHARDS) {
      const size = await this.redis.llen(shardKey);
      distribution[shardKey] = size;

      // 특정 샤드에 메시지가 몰리면 경고
      if (size > 500) {
        warnings.push(`샤드 ${shardKey}에 메시지 과다: ${size}개`);
      }
    }

    // DLQ 확인
    const dlqSize = await this.redis.llen(this.DLQ_KEY);
    if (dlqSize > 50) {
      warnings.push(`Dead Letter Queue에 ${dlqSize}개 실패 메시지`);
    }

    const totalSize = Object.values(distribution).reduce(
      (sum, size) => sum + size,
      0,
    );
    // 경고 임계값은 관찰 신호일 뿐 장애 상태가 아니다. 총 큐 크기나
    // DLQ가 critical 한도를 넘을 때만 unhealthy로 판정한다.
    const healthy = totalSize < 1000 && dlqSize < 100;

    return {
      healthy,
      totalSize,
      distribution,
      warnings,
    };
  }

  /**
   * Clear all queues (use with caution)
   */
  async clearQueues(): Promise<void> {
    const allQueues = [
      ...this.QUEUE_KEYS.SHARDS,
      this.QUEUE_KEYS.DEFAULT,
      this.DLQ_KEY,
    ];

    await Promise.all(allQueues.map((key) => this.redis.del(key)));

    this.logger.warn("[큐 초기화] 모든 큐가 삭제되었습니다");
  }

  private objectToHash(obj: Record<string, any>): Record<string, string> {
    const hash: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        hash[key] = typeof value === "string" ? value : JSON.stringify(value);
      }
    }
    return hash;
  }
}
