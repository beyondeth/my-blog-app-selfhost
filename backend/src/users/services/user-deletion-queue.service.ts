import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { UserDeletionLog } from '../entities/user-deletion-log.entity';
import { UnifiedRedisService } from '../../redis/unified-redis.service';

/**
 * 사용자 삭제 큐 서비스
 * - 백그라운드 삭제 작업을 큐로 관리
 * - 재시도 로직 및 실패 추적
 * - Dead Letter Queue 지원
 */

export interface DeletionJob {
  id: string;
  userId: string;
  type: 'soft-delete' | 'delete-files' | 'delete-cascade';
  createdAt: string;
  retryCount: number;
  metadata?: Record<string, any>;
}

@Injectable()
export class UserDeletionQueueService {
  private readonly logger = new Logger(UserDeletionQueueService.name);

  private readonly QUEUE_KEY = 'user-deletion:queue';
  private readonly DLQ_KEY = 'user-deletion:dlq';
  private readonly PROCESSING_KEY = 'user-deletion:processing';
  private readonly METRICS_KEY = 'user-deletion:metrics';
  private readonly MAX_RETRIES = 5;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(UserDeletionLog)
    private readonly deletionLogRepository: Repository<UserDeletionLog>,
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {}

  /**
   * 삭제 작업을 큐에 추가
   */
  async addDeletionJob(
    userId: string,
    type: DeletionJob['type'],
    metadata?: Record<string, any>,
  ): Promise<string> {
    const jobId = `${userId}-${type}-${Date.now()}`;
    const job: DeletionJob = {
      id: jobId,
      userId,
      type,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      metadata,
    };

    await this.redis.lpush(this.QUEUE_KEY, JSON.stringify(job));
    await this.redis.hincrby(this.METRICS_KEY, 'totalQueued', 1);

    this.logger.log(`Deletion job added: ${jobId} (type: ${type})`);
    return jobId;
  }

  /**
   * 큐에서 작업 가져오기 (배치 처리)
   */
  async dequeueJobs(batchSize: number = 10): Promise<DeletionJob[]> {
    const jobs: DeletionJob[] = [];

    for (let i = 0; i < batchSize; i++) {
      const data = await this.redis.rpop(this.QUEUE_KEY);
      if (!data) break;

      try {
        const job = JSON.parse(data);
        jobs.push(job);

        // 처리 중 목록에 추가 (타임아웃 감지용)
        await this.unifiedRedisService.setWithExpiry(
          `${this.PROCESSING_KEY}:${job.id}`,
          data,
          3600, // 1시간 타임아웃
        );
      } catch (error) {
        this.logger.error('Failed to parse deletion job:', error);
        await this.redis.lpush(this.DLQ_KEY, data);
      }
    }

    return jobs;
  }

  /**
   * 작업 완료 처리
   */
  async markJobComplete(jobId: string): Promise<void> {
    await this.unifiedRedisService.del(`${this.PROCESSING_KEY}:${jobId}`);
    await this.redis.hincrby(this.METRICS_KEY, 'totalProcessed', 1);
    this.logger.log(`Job completed: ${jobId}`);
  }

  /**
   * 작업 실패 처리 (재시도 또는 DLQ 이동)
   */
  async markJobFailed(
    job: DeletionJob,
    error: string,
  ): Promise<void> {
    job.retryCount++;

    // 재시도 횟수 초과 시 DLQ로 이동
    if (job.retryCount >= this.MAX_RETRIES) {
      await this.moveToDLQ(job, error);
      await this.unifiedRedisService.del(`${this.PROCESSING_KEY}:${job.id}`);
      return;
    }

    // 재시도 (지수 백오프)
    const backoffSeconds = Math.pow(2, job.retryCount) * 60; // 2^n 분
    await this.unifiedRedisService.del(`${this.PROCESSING_KEY}:${job.id}`);

    // 지연된 재시도를 위해 일정 시간 후 다시 큐에 추가
    setTimeout(async () => {
      await this.redis.lpush(this.QUEUE_KEY, JSON.stringify(job));
      this.logger.warn(
        `Job retry scheduled: ${job.id} (attempt ${job.retryCount}/${this.MAX_RETRIES})`,
      );
    }, backoffSeconds * 1000);
  }

  /**
   * Dead Letter Queue로 이동
   */
  private async moveToDLQ(job: DeletionJob, error: string): Promise<void> {
    const dlqEntry = {
      ...job,
      failedAt: new Date().toISOString(),
      error,
    };

    await this.redis.lpush(this.DLQ_KEY, JSON.stringify(dlqEntry));
    await this.redis.hincrby(this.METRICS_KEY, 'totalFailed', 1);

    // UserDeletionLog 업데이트
    await this.deletionLogRepository.update(
      { userId: job.userId, status: 'in_progress' },
      {
        status: 'failed',
        failureReason: error,
        retryCount: job.retryCount,
        lastRetryAt: new Date(),
      },
    );

    this.logger.error(
      `Job moved to DLQ: ${job.id} after ${job.retryCount} retries. Error: ${error}`,
    );

    // TODO: 관리자 알림 (이메일/슬랙)
  }

  /**
   * DLQ에서 작업 복구
   */
  async recoverFromDLQ(limit: number = 10): Promise<DeletionJob[]> {
    const jobs: DeletionJob[] = [];

    for (let i = 0; i < limit; i++) {
      const data = await this.redis.rpop(this.DLQ_KEY);
      if (!data) break;

      try {
        const job = JSON.parse(data);
        // 재시도 카운터 초기화하고 다시 큐에 추가
        job.retryCount = 0;
        await this.redis.lpush(this.QUEUE_KEY, JSON.stringify(job));
        jobs.push(job);
      } catch (error) {
        this.logger.error('Failed to recover DLQ job:', error);
      }
    }

    if (jobs.length > 0) {
      this.logger.log(`Recovered ${jobs.length} jobs from DLQ`);
    }

    return jobs;
  }

  /**
   * 큐 메트릭 조회
   */
  async getMetrics(): Promise<{
    queueSize: number;
    dlqSize: number;
    processingCount: number;
    totalQueued: number;
    totalProcessed: number;
    totalFailed: number;
  }> {
    const [queueSize, dlqSize, processingKeys, metrics] = await Promise.all([
      this.redis.llen(this.QUEUE_KEY),
      this.redis.llen(this.DLQ_KEY),
      this.redis.keys(`${this.PROCESSING_KEY}:*`),
      this.redis.hgetall(this.METRICS_KEY),
    ]);

    return {
      queueSize,
      dlqSize,
      processingCount: processingKeys.length,
      totalQueued: parseInt(metrics.totalQueued || '0', 10),
      totalProcessed: parseInt(metrics.totalProcessed || '0', 10),
      totalFailed: parseInt(metrics.totalFailed || '0', 10),
    };
  }

  /**
   * 타임아웃된 작업 감지 및 재큐
   */
  async checkTimeouts(): Promise<void> {
    const processingKeys = await this.redis.keys(`${this.PROCESSING_KEY}:*`);

    for (const key of processingKeys) {
      const ttl = await this.redis.ttl(key);

      // TTL이 10분 미만이면 타임아웃 임박
      if (ttl < 600 && ttl > 0) {
        const data = await this.unifiedRedisService.get(key);
        if (data) {
          try {
            const job: DeletionJob = JSON.parse(data);
            this.logger.warn(`Job timeout detected: ${job.id}, re-queuing...`);

            await this.markJobFailed(job, 'Processing timeout');
          } catch (error) {
            this.logger.error('Failed to handle timeout:', error);
          }
        }
      }
    }
  }
}
