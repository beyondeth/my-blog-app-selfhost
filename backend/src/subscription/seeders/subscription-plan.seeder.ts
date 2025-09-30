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
          maxMcpPostsPerDay: 5,
          maxMcpPostsPerMonth: 30,
          maxBlogCount: 1,
          analytics: 'none' as const,
          removeAds: false,
          exportData: false,
          scheduledPosts: false,
        },
        metadata: {
          highlights: [
            'MCP 자동포스팅 일 5건 / 월 30건',
            '무제한 일반 포스트 작성',
            '팔로우 기능',
            '블로그 미공개 기능',
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
          monthly: 990, // ₩990
          yearly: 9860, // ₩9,860 (연간 결제 시 17% 할인: 990 × 12 × 0.83)
          currency: 'KRW',
          discountPercentage: 17,
        },
        features: {
          maxMcpPostsPerDay: 10,
          maxMcpPostsPerMonth: 200,
          maxBlogCount: 1,
          analytics: 'basic' as const,
          removeAds: true,
          exportData: true,
          scheduledPosts: false,
        },
        metadata: {
          highlights: [
            'MCP 자동포스팅 일 10건 / 월 200건',
            '무제한 일반 포스트 작성',
            '팔로우 기능',
            '블로그 미공개 기능',
            'DM 채팅 기능',
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
          monthly: 1500, // ₩1,500
          yearly: 14940, // ₩14,940 (연간 결제 시 17% 할인: 1500 × 12 × 0.83)
          currency: 'KRW',
          discountPercentage: 17,
        },
        features: {
          maxMcpPostsPerDay: 20,
          maxMcpPostsPerMonth: 400,
          maxBlogCount: 1,
          analytics: 'advanced' as const,
          removeAds: true,
          exportData: true,
          scheduledPosts: true,
        },
        metadata: {
          highlights: [
            'MCP 자동포스팅 일 20건 / 월 400건',
            '무제한 일반 포스트 작성',
            '팔로우 기능',
            '블로그 미공개 기능',
            'DM 채팅 기능',
          ],
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