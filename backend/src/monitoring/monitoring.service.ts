import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { SuspiciousRequest } from './entities/suspicious-request.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

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
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private requestQueue: SuspiciousRequestDto[] = [];
  private readonly BATCH_SIZE = 10;
  private readonly FLUSH_INTERVAL = 5000; // 5 seconds

  constructor(
    @InjectRepository(SuspiciousRequest)
    private suspiciousRequestRepository: Repository<SuspiciousRequest>,
  ) {
    // Flush queue periodically
    setInterval(() => this.flushQueue(), this.FLUSH_INTERVAL);
  }

  /**
   * Log a suspicious request
   */
  async logSuspiciousRequest(data: SuspiciousRequestDto): Promise<void> {
    this.requestQueue.push(data);
    
    // Log immediately for debugging
    this.logger.warn(`Suspicious request: ${data.requestType} from ${data.ipAddress} - ${data.reason}`);
    
    // Flush if queue is full
    if (this.requestQueue.length >= this.BATCH_SIZE) {
      await this.flushQueue();
    }
  }

  /**
   * Batch insert suspicious requests
   */
  private async flushQueue(): Promise<void> {
    if (this.requestQueue.length === 0) return;

    const requests = [...this.requestQueue];
    this.requestQueue = [];

    try {
      await this.suspiciousRequestRepository.save(requests);
      this.logger.log(`Flushed ${requests.length} suspicious requests to database`);
    } catch (error) {
      this.logger.error('Failed to save suspicious requests:', error);
      // Re-add to queue for retry
      this.requestQueue.unshift(...requests);
    }
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
    const since = new Date();
    since.setHours(since.getHours() - hours);

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

    // 상위 IP 주소 (topOffenders를 topIPs로 변경)
    const topIPs = await this.suspiciousRequestRepository
      .createQueryBuilder('sr')
      .select('sr.ipAddress', 'ip')
      .addSelect('COUNT(*)', 'count')
      .where('sr.createdAt > :since', { since })
      .groupBy('sr.ipAddress')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany();

    // 상위 엔드포인트 추가
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

    return {
      totalRequests,
      unresolvedCount,
      todayCount,
      severityCounts,
      topIPs,
      topEndpoints,
      summary: severityStats,
      hourlyTrend,
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
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.suspiciousRequestRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :date', { date: thirtyDaysAgo })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old suspicious request records`);
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