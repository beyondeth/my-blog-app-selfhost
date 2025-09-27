import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { SuspiciousRequest } from './entities/suspicious-request.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue, Worker, Job } from 'bullmq';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';
import { DateUtils } from '../common/utils/date.utils';

export interface SuspiciousRequestDto {
  requestType: string;
  ipAddress: string;
  endpoint: string;
  userId?: string;
  userEmail?: string;
  requestDetails: any;
  userAgent?: string;
  reason: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'WARNING';
}

@Injectable()
export class MonitoringService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MonitoringService.name);
  private suspiciousQueue: Queue<SuspiciousRequestDto>;
  private worker: Worker<SuspiciousRequestDto>;

  constructor(
    @InjectRepository(SuspiciousRequest)
    private suspiciousRequestRepository: Repository<SuspiciousRequest>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    // BullMQ Queue 초기화
    this.suspiciousQueue = new Queue('suspicious-requests', {
      connection: this.redis.duplicate(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      },
    });

    // Worker 초기화 - Queue 처리
    this.worker = new Worker(
      'suspicious-requests',
      async (job: Job<SuspiciousRequestDto>) => {
        await this.processSuspiciousRequest(job.data);
      },
      {
        connection: this.redis.duplicate(),
        concurrency: 10, // 동시 처리 개수
        limiter: {
          max: 100,
          duration: 1000, // 초당 최대 100개 처리
        },
      },
    );

    // Worker 이벤트 핸들러
    this.worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed`);
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed:`, err);
    });

    this.logger.log('MonitoringService initialized with BullMQ');
  }

  async onModuleDestroy() {
    // Graceful shutdown
    await this.worker?.close();
    await this.suspiciousQueue?.close();
    this.logger.log('MonitoringService shutdown completed');
  }

  /**
   * Process a single suspicious request (배치 처리에서 호출)
   */
  private async processSuspiciousRequest(data: SuspiciousRequestDto): Promise<void> {
    try {
      await this.suspiciousRequestRepository.save(data);
      this.logger.debug(`Processed suspicious request: ${data.requestType}`);
    } catch (error) {
      this.logger.error('Failed to save suspicious request:', error);
      throw error; // BullMQ가 재시도 처리
    }
  }

  /**
   * Log a suspicious request (Queue에 추가)
   */
  async logSuspiciousRequest(data: SuspiciousRequestDto): Promise<void> {
    try {
      // Queue에 추가
      await this.suspiciousQueue.add('suspicious-request', data, {
        priority: this.getPriorityBySeverity(data.severity),
      });

      // 즉시 로깅 (디버깅용)
      this.logger.warn(
        `Suspicious request queued: ${data.requestType} from ${data.ipAddress} - ${data.reason}`,
      );
    } catch (error) {
      this.logger.error('Failed to queue suspicious request:', error);
      // 큐 추가 실패 시 직접 저장 (fallback)
      try {
        await this.suspiciousRequestRepository.save(data);
      } catch (saveError) {
        this.logger.error('Failed to save suspicious request directly:', saveError);
      }
    }
  }

  /**
   * Get priority based on severity
   */
  private getPriorityBySeverity(severity?: string): number {
    switch (severity) {
      case 'CRITICAL':
        return 1;
      case 'HIGH':
        return 2;
      case 'MEDIUM':
        return 3;
      case 'LOW':
        return 4;
      case 'WARNING':
      default:
        return 5;
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats() {
    const waiting = await this.suspiciousQueue.getWaitingCount();
    const active = await this.suspiciousQueue.getActiveCount();
    const completed = await this.suspiciousQueue.getCompletedCount();
    const failed = await this.suspiciousQueue.getFailedCount();
    const delayed = await this.suspiciousQueue.getDelayedCount();

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + delayed,
    };
  }

  /**
   * Get suspicious requests with filtering
   */
  async getSuspiciousRequests(options: {
    page?: number;
    limit?: number;
    requestType?: string;
    severity?: string;
    startDate?: Date;
    endDate?: Date;
    ipAddress?: string;
    isResolved?: boolean;
  }) {
    const {
      page = 1,
      limit = 20,
      requestType,
      severity,
      startDate,
      endDate,
      ipAddress,
      isResolved,
    } = options;

    const query = this.suspiciousRequestRepository.createQueryBuilder('sr');

    if (requestType) {
      query.andWhere('sr.requestType = :requestType', { requestType });
    }

    if (severity) {
      query.andWhere('sr.severity = :severity', { severity });
    }

    if (ipAddress) {
      query.andWhere('sr.ipAddress = :ipAddress', { ipAddress });
    }

    if (isResolved !== undefined) {
      query.andWhere('sr.isResolved = :isResolved', { isResolved });
    }

    if (startDate && endDate) {
      query.andWhere('sr.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    query
      .orderBy('sr.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await query.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get statistics for dashboard
   */
  async getStatistics(hours: number = 24) {
    const since = DateUtils.fromNowSubtractHours(hours);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 전체 요청 수
    const totalRequests = await this.suspiciousRequestRepository.count();

    // 미해결 요청 수
    const unresolvedCount = await this.suspiciousRequestRepository.count({
      where: { isResolved: false },
    });

    // 오늘 발생한 요청 수
    const todayCount = await this.suspiciousRequestRepository
      .createQueryBuilder('sr')
      .where('sr.createdAt >= :today', { today })
      .getCount();

    // 심각도별 통계
    const severityStats = await this.suspiciousRequestRepository
      .createQueryBuilder('sr')
      .select('sr.severity', 'severity')
      .addSelect('COUNT(*)', 'count')
      .groupBy('sr.severity')
      .getRawMany();

    // 심각도별 카운트 객체 생성
    const severityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      WARNING: 0,
    };

    severityStats.forEach(stat => {
      if (stat.severity in severityCounts) {
        severityCounts[stat.severity] = parseInt(stat.count);
      }
    });

    // 상위 IP 주소
    const topIPs = await this.suspiciousRequestRepository
      .createQueryBuilder('sr')
      .select('sr.ipAddress', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('sr.createdAt > :since', { since })
      .groupBy('sr.ipAddress')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // 상위 엔드포인트
    const topEndpoints = await this.suspiciousRequestRepository
      .createQueryBuilder('sr')
      .select('sr.endpoint', 'endpoint')
      .addSelect('COUNT(*)', 'count')
      .where('sr.createdAt > :since', { since })
      .groupBy('sr.endpoint')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // 시간별 추세
    const hourlyTrend = await this.suspiciousRequestRepository
      .createQueryBuilder('sr')
      .select(`DATE_TRUNC('hour', sr."createdAt")`, 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('sr.createdAt > :since', { since })
      .groupBy('hour')
      .orderBy('hour', 'ASC')
      .getRawMany();

    // Queue 통계 추가
    const queueStats = await this.getQueueStats();

    return {
      totalRequests,
      unresolvedCount,
      todayCount,
      severityCounts,
      topIPs,
      topEndpoints,
      summary: severityStats,
      hourlyTrend,
      queueStats, // BullMQ 큐 통계 추가
    };
  }

  /**
   * Mark request as resolved or unresolved
   */
  async resolveRequest(id: string, note: string, isResolved: boolean = true): Promise<void> {
    await this.suspiciousRequestRepository.update(id, {
      isResolved,
      resolvedNote: note,
      resolvedAt: new Date(),
    });
  }

  /**
   * Clean up old records (keep last 30 days)
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldRecords(): Promise<void> {
    const thirtyDaysAgo = DateUtils.fromNowSubtractDays(30);

    const result = await this.suspiciousRequestRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :date', { date: thirtyDaysAgo })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old suspicious request records`);

    // BullMQ 큐에서도 오래된 완료된 작업 정리
    await this.suspiciousQueue.clean(30 * 24 * 60 * 60 * 1000, 100); // 30일 이상 된 작업 100개씩 삭제
  }

  /**
   * Helper method for excessive limit requests
   */
  async logExcessiveLimitRequest(
    ipAddress: string,
    endpoint: string,
    attemptedLimit: number,
    actualLimit: number,
    userId?: string,
    userEmail?: string,
  ): Promise<void> {
    await this.logSuspiciousRequest({
      requestType: 'EXCESSIVE_LIMIT',
      ipAddress,
      endpoint,
      userId,
      userEmail,
      requestDetails: {
        method: 'GET',
        query: { limit: attemptedLimit },
        attemptedLimit,
        actualLimit,
      },
      reason: `Attempted to request ${attemptedLimit} items (max allowed: ${actualLimit})`,
      severity: attemptedLimit > 1000 ? 'HIGH' : attemptedLimit > 100 ? 'MEDIUM' : 'LOW',
    });
  }
}