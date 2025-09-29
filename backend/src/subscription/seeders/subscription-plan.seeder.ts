import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import { SubscriptionTier } from '../../common/enums/subscription.enum';

/**
 * 구독 플랜 시더
 * 초기 구독 플랜 데이터를 데이터베이스에 생성
 */
@Injectable()
export class SubscriptionPlanSeeder {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly subscriptionPlanRepository: Repository<SubscriptionPlan>,
  ) {}

  /**
   * 시드 데이터 실행
   * 이미 존재하는 플랜은 업데이트, 없는 플랜은 새로 생성
   */
  async seed() {
    console.log('🌱 Seeding subscription plans...');

    const plans = [
      // FREE 플랜
      {
        tier: SubscriptionTier.FREE,
        name: 'Free',
        displayName: '무료 플랜',
        description: '개인 블로그를 시작하는 분들을 위한 무료 플랜',
        pricing: {
          monthly: 0,
          yearly: 0,
          currency: 'KRW',
        },
        features: {
          maxPostsPerMonth: 5,
          maxBlogCount: 1,
          analytics: 'none' as const,
          removeAds: false,
          exportData: false,
          scheduledPosts: false,
        },
        metadata: {
          highlights: [
            '매월 5개 포스트 작성',
            '1개 블로그',
            '기본 기능 제공',
            '커뮤니티 지원',
          ],
          limitations: [
            '광고 표시',
            '기본 통계만 제공',
            '데이터 내보내기 불가',
          ],
        },
        isPopular: false,
        isActive: true,
        sortOrder: 1,
      },

      // STARTER 플랜
      {
        tier: SubscriptionTier.STARTER,
        name: 'Starter',
        displayName: '스타터 플랜',
        description: '개인 크리에이터와 소규모 팀을 위한 플랜',
        pricing: {
          monthly: 9000, // ₩9,000
          yearly: 90000, // ₩90,000 (연간 결제 시 17% 할인)
          currency: 'KRW',
          discountPercentage: 17,
        },
        features: {
          maxPostsPerMonth: 30,
          maxBlogCount: 1,
          analytics: 'basic' as const,
          removeAds: true,
          exportData: true,
          scheduledPosts: false,
        },
        metadata: {
          highlights: [
            '매월 30개 포스트 작성',
            '1개 블로그',
            '기본 분석 통계',
            '광고 제거',
            '데이터 내보내기',
            '이메일 지원',
          ],
          limitations: [
            '예약 발행 불가',
            '고급 통계 미제공',
          ],
        },
        isPopular: true,
        isActive: true,
        sortOrder: 2,
      },

      // PRO 플랜
      {
        tier: SubscriptionTier.PRO,
        name: 'Pro',
        displayName: '프로 플랜',
        description: '전문 블로거와 기업을 위한 프리미엄 플랜',
        pricing: {
          monthly: 19000, // ₩19,000
          yearly: 190000, // ₩190,000 (연간 결제 시 17% 할인)
          currency: 'KRW',
          discountPercentage: 17,
        },
        features: {
          maxPostsPerMonth: -1, // 무제한
          maxBlogCount: 3,
          analytics: 'advanced' as const,
          removeAds: true,
          exportData: true,
          scheduledPosts: true,
        },
        metadata: {
          highlights: [
            '무제한 포스트 작성',
            '최대 3개 블로그',
            '고급 분석 통계',
            '광고 제거',
            '데이터 내보내기',
            '예약 발행',
            '우선 지원',
            'API 액세스',
          ],
          limitations: [],
        },
        isPopular: false,
        isActive: true,
        sortOrder: 3,
      },
    ];

    for (const planData of plans) {
      // 기존 플랜 확인
      let plan = await this.subscriptionPlanRepository.findOne({
        where: {
          tier: planData.tier,
        },
      });

      if (plan) {
        // 기존 플랜 업데이트
        Object.assign(plan, planData);
        await this.subscriptionPlanRepository.save(plan);
        console.log(`✅ Updated plan: ${planData.displayName}`);
      } else {
        // 새 플랜 생성
        plan = this.subscriptionPlanRepository.create(planData);
        await this.subscriptionPlanRepository.save(plan);
        console.log(`✅ Created plan: ${planData.displayName}`);
      }
    }

    console.log('🎉 Subscription plans seeding completed!');
  }

  /**
   * 시드 데이터 초기화 (삭제)
   * 테스트나 개발 환경에서 사용
   */
  async clear() {
    console.log('🗑️ Clearing subscription plans...');
    await this.subscriptionPlanRepository.delete({});
    console.log('✅ Subscription plans cleared!');
  }
}