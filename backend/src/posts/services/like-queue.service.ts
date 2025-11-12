import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import {
  QueuedLike,
  RedisLikeData,
  LikeQueueMetrics,
} from '../interfaces/like-queue.interface';

/**
 * 좋아요 큐 서비스
 * Chat 모듈의 ChatQueueService 패턴을 재사용
 *
 * 핵심 기능:
 * 1. Redis를 사용한 큐 관리
 * 2. 샤딩을 통한 부하 분산
 * 3. 중복 요청 자동 병합 (같은 user + post)
 * 4. Dead Letter Queue (실패 처리)
 * 5. 메트릭 수집
 */
@Injectable()
export class LikeQueueService {
  private readonly logger = new Logger(LikeQueueService.name);

  /**
   * 큐 키 구조
   * - 샤드별 큐: 부하 분산으로 병목현상 해결
   * - 라운드로빈 방식으로 균등 분배
   */
  private readonly QUEUE_SHARDS = 4; // 샤드 개수
  private readonly QUEUE_KEYS = {
    // 샤드별 큐 (0~3)
    SHARDS: Array.from({ length: 4 }, (_, i) => `likes:queue:shard:${i}`),
  };

  private readonly DLQ_KEY = 'likes:queue:dlq';
  private readonly LIKE_PREFIX = 'likes:data:';
  private readonly METRICS_KEY = 'likes:metrics';

  // 중복 제거용: user-post 조합 추적
  private readonly PENDING_KEY = 'likes:pending:';

  // 샤드 선택을 위한 라운드 로빈 카운터
  private shardCounter = 0;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * 좋아요 요청을 큐에 추가
   *
   * @param postId - 포스트 ID
   * @param userId - 사용자 ID
   * @param action - 'like' | 'unlike'
   * @returns 큐에 추가된 좋아요 데이터
   *
   * 중복 처리:
   * - 같은 user + post 조합이 이미 큐에 있으면 덮어씀
   * - 예: like → unlike → like 연속 클릭 시 마지막 like만 처리
   */
  async queueLike(
    postId: string,
    userId: string,
    action: 'like' | 'unlike',
  ): Promise<QueuedLike> {
    const likeId = uuidv4();
    const now = new Date();
    const pendingKey = `${this.PENDING_KEY}${userId}:${postId}`;

    const queuedLike: QueuedLike = {
      id: likeId,
      postId,
      userId,
      action,
      queuedAt: now,
      retryCount: 0,
    };

    const redisData: RedisLikeData = {
      id: likeId,
      postId,
      userId,
      action,
      queuedAt: now.toISOString(),
    };

    const pipeline = this.redis.pipeline();

    // 1. 이전 pending 요청 확인 및 제거
    const existingLikeId = await this.redis.get(pendingKey);
    if (existingLikeId) {
      // 기존 요청을 큐에서 제거 시도 (모든 샤드 확인)
      for (const shardKey of this.QUEUE_KEYS.SHARDS) {
        // LREM: 리스트에서 특정 값 제거
        pipeline.lrem(shardKey, 0, existingLikeId);
      }
      pipeline.del(`${this.LIKE_PREFIX}${existingLikeId}`);
    }

    // 2. 새 요청 저장
    pipeline.hset(
      `${this.LIKE_PREFIX}${likeId}`,
      this.objectToHash(redisData),
    );

    // 3. pending 키 업데이트 (중복 추적용 + action 정보 저장)
    // Controller가 Redis pending 확인하여 연속 클릭 시 DB 조회 없이 처리
    pipeline.setex(pendingKey, 10, JSON.stringify({ likeId, action })); // 10초 TTL

    // 4. 샤드 선택 및 큐 추가 (라운드로빈)
    const shardIndex = this.shardCounter % this.QUEUE_SHARDS;
    const selectedQueue = this.QUEUE_KEYS.SHARDS[shardIndex];
    this.shardCounter++;

    pipeline.lpush(selectedQueue, likeId);

    // 5. 데이터 TTL 설정 (1시간)
    pipeline.expire(`${this.LIKE_PREFIX}${likeId}`, 3600);

    // 6. 메트릭 업데이트
    pipeline.hincrby(this.METRICS_KEY, 'totalQueued', 1);

    await pipeline.exec();

    this.logger.debug(
      `Like queued: ${likeId} (user: ${userId}, post: ${postId}, action: ${action})`,
    );
    return queuedLike;
  }

  /**
   * 배치 처리를 위해 큐에서 좋아요 요청 가져오기
   *
   * @param batchSize - 가져올 최대 개수
   * @returns 좋아요 요청 배열
   *
   * 동작:
   * - 모든 샤드에서 균등하게 가져옴
   * - 파싱 실패한 요청은 DLQ로 이동
   */
  async dequeueLikes(batchSize: number): Promise<QueuedLike[]> {
    const likes: QueuedLike[] = [];
    let remainingBatch = batchSize;

    // 샤드별로 균등하게 수집
    const likesPerShard = Math.ceil(remainingBatch / this.QUEUE_KEYS.SHARDS.length);

    for (const shardKey of this.QUEUE_KEYS.SHARDS) {
      if (remainingBatch <= 0) break;

      const shardLikes = await this.dequeueFromQueue(
        shardKey,
        Math.min(likesPerShard, remainingBatch),
      );
      likes.push(...shardLikes);
      remainingBatch -= shardLikes.length;
    }

    if (likes.length > 0) {
      this.logger.debug(`[큐 처리] ${likes.length}개 좋아요 요청 수집 완료`);
    }

    return likes;
  }

  /**
   * 특정 큐에서 좋아요 요청 가져오기 (내부 메서드)
   */
  private async dequeueFromQueue(
    queueKey: string,
    count: number,
  ): Promise<QueuedLike[]> {
    const likes: QueuedLike[] = [];

    if (count <= 0) return likes;

    // 파이프라인으로 한번에 처리 (네트워크 오버헤드 감소)
    const pipeline = this.redis.pipeline();
    for (let i = 0; i < count; i++) {
      pipeline.rpop(queueKey);
    }

    const results = await pipeline.exec();

    // 각 likeId로 실제 데이터 조회
    const likeIds: string[] = [];
    for (const [err, data] of results) {
      if (!err && data) {
        likeIds.push(data as string);
      }
    }

    if (likeIds.length === 0) return likes;

    // 모든 like 데이터 한번에 조회
    const dataPipeline = this.redis.pipeline();
    for (const likeId of likeIds) {
      dataPipeline.hgetall(`${this.LIKE_PREFIX}${likeId}`);
    }

    const dataResults = await dataPipeline.exec();

    for (let i = 0; i < dataResults.length; i++) {
      const [err, data] = dataResults[i];
      if (!err && data && Object.keys(data).length > 0) {
        try {
          const redisData = data as unknown as RedisLikeData;
          const like: QueuedLike = {
            id: redisData.id,
            postId: redisData.postId,
            userId: redisData.userId,
            action: redisData.action,
            queuedAt: new Date(redisData.queuedAt),
            retryCount: 0,
          };
          likes.push(like);
        } catch (parseError) {
          this.logger.error(`[좋아요 파싱 오류] ${queueKey}:`, parseError);
          // 파싱 실패한 요청은 DLQ로
          await this.redis.lpush(this.DLQ_KEY, likeIds[i]);
        }
      }
    }

    return likes;
  }

  /**
   * 실패한 좋아요 요청을 DLQ로 이동
   */
  async moveToDeadLetterQueue(likes: QueuedLike[]): Promise<void> {
    if (likes.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const like of likes) {
      like.retryCount = (like.retryCount || 0) + 1;
      pipeline.lpush(this.DLQ_KEY, JSON.stringify(like));
    }

    // 메트릭 업데이트
    pipeline.hincrby(this.METRICS_KEY, 'totalFailed', likes.length);

    await pipeline.exec();

    this.logger.warn(`[DLQ] ${likes.length}개 좋아요 요청 이동`);
  }

  /**
   * 처리 완료된 좋아요 데이터 정리
   */
  async clearProcessedLikes(likeIds: string[]): Promise<void> {
    if (likeIds.length === 0) return;

    const pipeline = this.redis.pipeline();

    for (const id of likeIds) {
      pipeline.del(`${this.LIKE_PREFIX}${id}`);
    }

    await pipeline.exec();
  }

  /**
   * 특정 포스트의 모든 좋아요 요청 제거
   *
   * @description
   * 포스트 삭제 시 관련 좋아요 큐 항목들을 정리하여 FK 위반 방지
   * - 모든 샤드 큐에서 해당 포스트의 좋아요 검색 및 제거
   * - pending 키도 정리
   *
   * @param postId - 삭제될 포스트 ID
   */
  async removeLikesForPost(postId: string): Promise<number> {
    let removedCount = 0;

    try {
      // 1. 모든 샤드 큐에서 해당 포스트의 좋아요 검색 및 제거
      for (const shardKey of this.QUEUE_KEYS.SHARDS) {
        // 큐의 모든 항목 가져오기
        const queueItems = await this.redis.lrange(shardKey, 0, -1);

        // 제거할 항목 식별
        const itemsToRemove: string[] = [];
        for (const itemId of queueItems) {
          // 데이터 확인
          const data = await this.redis.hgetall(`${this.LIKE_PREFIX}${itemId}`);
          if (data && data.postId === postId) {
            itemsToRemove.push(itemId);
          }
        }

        // 샤드 큐에서 제거
        if (itemsToRemove.length > 0) {
          const pipeline = this.redis.pipeline();
          for (const itemId of itemsToRemove) {
            // LREM으로 큐에서 제거 (value 기반)
            pipeline.lrem(shardKey, 0, itemId);
            // 데이터 삭제
            pipeline.del(`${this.LIKE_PREFIX}${itemId}`);
          }
          await pipeline.exec();
          removedCount += itemsToRemove.length;
        }
      }

      // 2. DLQ에서도 제거
      const dlqItems = await this.redis.lrange(this.DLQ_KEY, 0, -1);
      const dlqItemsToRemove: string[] = [];

      for (const itemId of dlqItems) {
        const data = await this.redis.hgetall(`${this.LIKE_PREFIX}${itemId}`);
        if (data && data.postId === postId) {
          dlqItemsToRemove.push(itemId);
        }
      }

      if (dlqItemsToRemove.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const itemId of dlqItemsToRemove) {
          pipeline.lrem(this.DLQ_KEY, 0, itemId);
          pipeline.del(`${this.LIKE_PREFIX}${itemId}`);
        }
        await pipeline.exec();
        removedCount += dlqItemsToRemove.length;
      }

      // 3. pending 키 정리 (패턴 매칭으로 일괄 삭제)
      const pendingPattern = `${this.PENDING_KEY}*:${postId}`;
      const pendingKeys = await this.redis.keys(pendingPattern);

      if (pendingKeys.length > 0) {
        await this.redis.del(...pendingKeys);
        removedCount += pendingKeys.length;
      }

      this.logger.log(
        `✅ Removed ${removedCount} like requests for deleted post ${postId}`,
      );

      return removedCount;
    } catch (error) {
      this.logger.error(
        `Failed to remove likes for post ${postId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * 큐 메트릭 조회
   */
  async getMetrics(): Promise<LikeQueueMetrics> {
    // 모든 큐 크기 수집
    const queueSizes = await Promise.all(
      this.QUEUE_KEYS.SHARDS.map((key) => this.redis.llen(key)),
    );

    const totalQueueSize = queueSizes.reduce((sum, size) => sum + size, 0);

    const [dlqSize, metrics] = await Promise.all([
      this.redis.llen(this.DLQ_KEY),
      this.redis.hgetall(this.METRICS_KEY),
    ]);

    // 큐 상태 로깅 (디버깅용)
    if (totalQueueSize > 100) {
      this.logger.debug(
        `[좋아요 큐 상태] 총: ${totalQueueSize}, ` +
          `샤드별: ${this.QUEUE_KEYS.SHARDS.map((key, i) => `S${i}:${queueSizes[i]}`).join(', ')}`,
      );
    }

    const totalQueued = parseInt(metrics.totalQueued || '0', 10);
    const totalProcessed = parseInt(metrics.totalProcessed || '0', 10);
    const totalFailed = parseInt(metrics.totalFailed || '0', 10);
    const totalProcessingTime = parseFloat(metrics.totalProcessingTime || '0');

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
   * 처리 메트릭 업데이트
   */
  async updateMetrics(
    processedCount: number,
    processingTime: number,
  ): Promise<void> {
    const pipeline = this.redis.pipeline();

    pipeline.hincrby(this.METRICS_KEY, 'totalProcessed', processedCount);
    pipeline.hincrbyfloat(
      this.METRICS_KEY,
      'totalProcessingTime',
      processingTime,
    );
    pipeline.hset(
      this.METRICS_KEY,
      'lastProcessedAt',
      new Date().toISOString(),
    );

    await pipeline.exec();
  }

  /**
   * DLQ에서 복구
   */
  async recoverFromDeadLetterQueue(limit: number = 10): Promise<QueuedLike[]> {
    const likes: QueuedLike[] = [];

    for (let i = 0; i < limit; i++) {
      const data = await this.redis.rpop(this.DLQ_KEY);
      if (!data) break;

      try {
        const like = JSON.parse(data);
        likes.push(like);
      } catch (error) {
        this.logger.error('[DLQ 파싱 실패]:', error);
      }
    }

    if (likes.length > 0) {
      // 재처리를 위해 큐에 추가
      for (const like of likes) {
        await this.queueLike(like.postId, like.userId, like.action);
      }

      this.logger.log(`[DLQ 복구] ${likes.length}개 좋아요 요청 복구`);
    }

    return likes;
  }

  /**
   * 큐 건강 상태 확인
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
        warnings.push(`샤드 ${shardKey}에 좋아요 요청 과다: ${size}개`);
      }
    }

    // DLQ 확인
    const dlqSize = await this.redis.llen(this.DLQ_KEY);
    if (dlqSize > 50) {
      warnings.push(`Dead Letter Queue에 ${dlqSize}개 실패 요청`);
    }

    const totalSize = Object.values(distribution).reduce(
      (sum, size) => sum + size,
      0,
    );
    const healthy = totalSize < 1000 && dlqSize < 100;

    return {
      healthy,
      totalSize,
      distribution,
      warnings,
    };
  }

  /**
   * 모든 큐 초기화 (주의: 프로덕션에서 사용 금지)
   */
  async clearQueues(): Promise<void> {
    const allQueues = [...this.QUEUE_KEYS.SHARDS, this.DLQ_KEY];

    await Promise.all(allQueues.map((key) => this.redis.del(key)));

    this.logger.warn('[좋아요 큐 초기화] 모든 큐가 삭제되었습니다');
  }

  /**
   * 객체를 Redis Hash 형식으로 변환
   */
  private objectToHash(obj: Record<string, any>): Record<string, string> {
    const hash: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null) {
        hash[key] = typeof value === 'string' ? value : JSON.stringify(value);
      }
    }
    return hash;
  }
}
