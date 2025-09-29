import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsageTracking } from './entities/usage-tracking.entity';
import { UsersService } from '../users/users.service';
import { ResourceType, SubscriptionTier } from '../common/enums/subscription.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

// 플랜별 제한 설정
const PLAN_LIMITS = {
  [SubscriptionTier.FREE]: {
    [ResourceType.POSTS]: 5,         // 월 5개 포스트
    [ResourceType.STORAGE]: 100,     // 100MB (사용 안 함)
    [ResourceType.VIEWS]: 1000,      // 월 1000 뷰 (사용 안 함)
    [ResourceType.API_CALLS]: 100,   // 월 100회 API 호출 (사용 안 함)
    maxBlogCount: 1,                 // 블로그 1개
  },
  [SubscriptionTier.STARTER]: {
    [ResourceType.POSTS]: 30,        // 월 30개 포스트
    [ResourceType.STORAGE]: 1000,    // 1GB (사용 안 함)
    [ResourceType.VIEWS]: 10000,     // 월 10000 뷰 (사용 안 함)
    [ResourceType.API_CALLS]: 1000,  // 월 1000회 API 호출 (사용 안 함)
    maxBlogCount: 1,                 // 블로그 1개
  },
  [SubscriptionTier.PRO]: {
    [ResourceType.POSTS]: -1,        // 무제한
    [ResourceType.STORAGE]: 10000,   // 10GB (사용 안 함)
    [ResourceType.VIEWS]: -1,        // 무제한 (사용 안 함)
    [ResourceType.API_CALLS]: -1,    // 무제한 (사용 안 함)
    maxBlogCount: 3,                 // 블로그 3개
  },
};

@Injectable()
export class UsageService {
  // 현재 사용자의 구독 정보를 캐시
  private userSubscriptionCache = new Map<string, { tier: SubscriptionTier; timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1분 캐시

  constructor(
    @InjectRepository(UsageTracking)
    private usageTrackingRepository: Repository<UsageTracking>,
    private usersService: UsersService,
    private eventEmitter: EventEmitter2,
  ) {
    // 구독 정보 변경 이벤트 리스닝
    this.eventEmitter.on('subscription.updated', (data: { userId: string; tier: SubscriptionTier }) => {
      this.userSubscriptionCache.set(data.userId, { tier: data.tier, timestamp: Date.now() });
    });
  }

  /**
   * 사용량 이력 조회
   */
  async getUsageHistory(
    userId: string,
    resourceType?: ResourceType,
    startDate?: Date,
    endDate?: Date
  ) {
    const query = this.usageTrackingRepository.createQueryBuilder('usage')
      .where('usage.userId = :userId', { userId });

    if (resourceType) {
      query.andWhere('usage.resourceType = :resourceType', { resourceType });
    }

    if (startDate) {
      query.andWhere('usage.recordedAt >= :startDate', { startDate });
    }

    if (endDate) {
      query.andWhere('usage.recordedAt <= :endDate', { endDate });
    }

    return await query
      .orderBy('usage.recordedAt', 'DESC')
      .getMany();
  }

  /**
   * 사용량 추적 (증가)
   */
  async trackUsage(
    userId: string,
    resourceType: ResourceType,
    amount: number = 1,
  ): Promise<UsageTracking> {
    // 현재 사용자의 구독 정보 확인 (캐시 또는 DB에서 조회)
    const tier = await this.getUserSubscriptionTier(userId);
    const limits = PLAN_LIMITS[tier];
    const limit = limits[resourceType];

    // 현재 월의 사용량 조회 또는 생성
    const usage = await this.getOrCreateMonthlyUsage(userId, resourceType, limit);

    // 사용 가능 여부 확인
    if (!usage.canUse(amount)) {
      const remainingUsage = usage.getRemainingUsage();
      throw new BadRequestException(
        `${this.getResourceDisplayName(resourceType)} 제한에 도달했습니다. ` +
        `현재 사용량: ${usage.count}/${limit}, ` +
        `남은 사용량: ${remainingUsage}. ` +
        `더 많은 사용량이 필요하시면 ${this.getUpgradeRecommendation(tier)} 플랜으로 업그레이드하세요.`
      );
    }

    // 사용량 증가
    usage.incrementUsage(amount);
    await this.usageTrackingRepository.save(usage);

    // 경고가 필요한 경우 (80% 이상 사용)
    if (usage.needsWarning() && usage.warningsSent < 3) {
      await this.sendUsageWarning(userId, resourceType, usage);
    }

    return usage;
  }

  /**
   * 사용량 감소 (삭제 시)
   */
  async decrementUsage(
    userId: string,
    resourceType: ResourceType,
    amount: number = 1,
  ): Promise<UsageTracking> {
    const usage = await this.getCurrentMonthUsage(userId, resourceType);

    if (usage) {
      usage.decrementUsage(amount);
      await this.usageTrackingRepository.save(usage);
    }

    return usage;
  }

  /**
   * 사용량 확인 (제한 체크만)
   */
  async checkUsageLimit(
    userId: string,
    resourceType: ResourceType,
    amount: number = 1,
  ): Promise<boolean> {
    // 사용자의 구독 티어 확인
    const tier = await this.getUserSubscriptionTier(userId);
    const limits = PLAN_LIMITS[tier];
    const limit = limits[resourceType];

    // 무제한인 경우
    if (limit === -1) return true;

    const usage = await this.getCurrentMonthUsage(userId, resourceType);
    if (!usage) return true; // 사용 이력이 없으면 사용 가능

    return usage.canUse(amount);
  }

  /**
   * 블로그 수 제한 확인
   */
  async checkBlogLimit(userId: string, currentBlogCount: number): Promise<boolean> {
    // 사용자의 구독 티어 확인
    const tier = await this.getUserSubscriptionTier(userId);
    const limits = PLAN_LIMITS[tier];

    return currentBlogCount < limits.maxBlogCount;
  }

  /**
   * 현재 월 사용량 조회
   */
  async getCurrentMonthUsage(
    userId: string,
    resourceType: ResourceType,
  ): Promise<UsageTracking | null> {
    const currentPeriod = this.getCurrentPeriod();

    return this.usageTrackingRepository.findOne({
      where: {
        userId,
        resourceType,
        period: currentPeriod,
      },
    });
  }

  /**
   * 모든 리소스의 현재 월 사용량 조회
   */
  async getAllCurrentMonthUsage(userId: string): Promise<UsageTracking[]> {
    const currentPeriod = this.getCurrentPeriod();

    return this.usageTrackingRepository.find({
      where: {
        userId,
        period: currentPeriod,
      },
    });
  }

  /**
   * 사용량 통계 조회
   */
  async getUsageStats(userId: string) {
    // 사용자의 구독 티어 확인
    const tier = await this.getUserSubscriptionTier(userId);
    const currentUsages = await this.getAllCurrentMonthUsage(userId);
    const limits = PLAN_LIMITS[tier];

    const stats = {
      tier: tier,
      limits: {},
      usage: {},
      percentages: {},
    };

    // 각 리소스별 통계 생성
    for (const [resourceType, limit] of Object.entries(limits)) {
      if (typeof limit !== 'number') continue;

      const usage = currentUsages.find(u => u.resourceType === resourceType as ResourceType);
      const currentCount = usage?.count || 0;
      const percentage = limit === -1 ? 0 : Math.round((currentCount / limit) * 100);

      stats.limits[resourceType] = limit;
      stats.usage[resourceType] = currentCount;
      stats.percentages[resourceType] = percentage;
    }

    // 블로그 수는 별도 처리
    const blogCount = await this.usersService.getUserBlogCount(userId);
    stats.limits['blogs'] = limits.maxBlogCount;
    stats.usage['blogs'] = blogCount;
    stats.percentages['blogs'] = Math.round((blogCount / limits.maxBlogCount) * 100);

    return stats;
  }

  /**
   * 월별 사용량 초기화 (크론 작업)
   */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async resetMonthlyUsage(): Promise<void> {
    console.log('[UsageService] 월별 사용량 초기화 시작');

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthPeriod = this.getPeriodFromDate(lastMonth);

    // 지난달 사용량 기록 보존 (아카이브)
    const lastMonthUsages = await this.usageTrackingRepository.find({
      where: {
        period: lastMonthPeriod,
      },
    });

    console.log(`[UsageService] ${lastMonthUsages.length}개의 지난달 사용량 기록 보존`);

    // 새로운 월 시작 - 자동으로 새 기록이 생성됨
    console.log('[UsageService] 월별 사용량 초기화 완료');
  }

  /**
   * 사용량 경고 체크 (크론 작업)
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async checkUsageWarnings(): Promise<void> {
    console.log('[UsageService] 사용량 경고 체크 시작');

    const currentPeriod = this.getCurrentPeriod();

    // 80% 이상 사용한 사용자들 찾기
    const highUsages = await this.usageTrackingRepository.find({
      where: {
        period: currentPeriod,
        limitReached: false, // 아직 제한에 도달하지 않은 경우만
      },
    });

    for (const usage of highUsages) {
      if (usage.needsWarning() && usage.warningsSent < 3) {
        await this.sendUsageWarning(usage.userId, usage.resourceType, usage);
      }
    }

    console.log('[UsageService] 사용량 경고 체크 완료');
  }

  // Helper Methods

  /**
   * 사용자의 구독 티어 조회
   * 캐시를 사용하거나 DB에서 직접 조회
   */
  private async getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
    // 캐시 확인
    const cached = this.userSubscriptionCache.get(userId);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.tier;
    }

    // DB에서 사용자 조회하여 구독 티어 확인
    // 기본값으로 FREE 티어 반환 (사용자가 구독 정보가 없을 경우)
    const user = await this.usersService.findById(userId);
    const tier = user?.subscriptionTier || SubscriptionTier.FREE;

    // 캐시 업데이트
    this.userSubscriptionCache.set(userId, { tier, timestamp: Date.now() });

    return tier;
  }

  /**
   * 현재 월 사용량 조회 또는 생성
   */
  private async getOrCreateMonthlyUsage(
    userId: string,
    resourceType: ResourceType,
    limit: number,
  ): Promise<UsageTracking> {
    const currentPeriod = this.getCurrentPeriod();

    let usage = await this.usageTrackingRepository.findOne({
      where: {
        userId,
        resourceType,
        period: currentPeriod,
      },
    });

    if (!usage) {
      usage = this.usageTrackingRepository.create({
        userId,
        resourceType,
        period: currentPeriod,
        count: 0,
        limit,
      });
      await this.usageTrackingRepository.save(usage);
    } else if (usage.limit !== limit) {
      // 플랜 변경으로 제한이 바뀐 경우 업데이트
      usage.limit = limit;
      await this.usageTrackingRepository.save(usage);
    }

    return usage;
  }

  /**
   * 현재 기간 (월) 가져오기
   */
  private getCurrentPeriod(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  /**
   * 날짜로부터 기간 가져오기
   */
  private getPeriodFromDate(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  /**
   * 리소스 표시 이름 가져오기
   */
  private getResourceDisplayName(resourceType: ResourceType): string {
    const names = {
      [ResourceType.POSTS]: '포스트',
      [ResourceType.STORAGE]: '저장공간',
      [ResourceType.VIEWS]: '조회수',
      [ResourceType.API_CALLS]: 'API 호출',
      [ResourceType.AI_CREDITS]: 'AI 크레딧',
    };
    return names[resourceType] || resourceType;
  }

  /**
   * 업그레이드 추천 플랜
   */
  private getUpgradeRecommendation(currentTier: SubscriptionTier): string {
    if (currentTier === SubscriptionTier.FREE) {
      return 'Starter 또는 Pro';
    } else if (currentTier === SubscriptionTier.STARTER) {
      return 'Pro';
    }
    return 'Enterprise (문의)';
  }

  /**
   * 사용량 경고 발송
   */
  private async sendUsageWarning(
    userId: string,
    resourceType: ResourceType,
    usage: UsageTracking,
  ): Promise<void> {
    // 여기에 이메일 또는 알림 발송 로직 구현
    console.log(
      `[UsageService] 사용량 경고 발송: User ${userId}, ` +
      `${this.getResourceDisplayName(resourceType)} ${usage.getUsagePercentage()}% 사용`
    );

    usage.warningsSent++;
    usage.lastWarningAt = new Date();
    await this.usageTrackingRepository.save(usage);
  }
}