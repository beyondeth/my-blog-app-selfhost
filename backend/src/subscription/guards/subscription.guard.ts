import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SubscriptionService } from '../subscription.service';
import { SubscriptionTier } from '../../common/enums/subscription.enum';
import { REQUIRED_TIER_KEY } from '../decorators/requires-tier.decorator';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private subscriptionService: SubscriptionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 데코레이터에서 필요한 최소 티어 가져오기
    const requiredTier = this.reflector.getAllAndOverride<SubscriptionTier>(
      REQUIRED_TIER_KEY,
      [context.getHandler(), context.getClass()],
    );

    // 티어 요구사항이 없으면 통과
    if (!requiredTier) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다');
    }

    // 사용자의 현재 구독 정보 확인
    const subscription = await this.subscriptionService.getUserSubscription(user.id);

    // 구독이 활성 상태인지 확인
    if (!subscription.isActive()) {
      throw new ForbiddenException('활성 구독이 필요합니다');
    }

    // 티어 레벨 확인
    if (!this.hasSufficientTier(subscription.tier, requiredTier)) {
      throw new ForbiddenException(
        `이 기능을 사용하려면 ${this.getTierDisplayName(requiredTier)} 이상의 플랜이 필요합니다. ` +
        `현재 플랜: ${this.getTierDisplayName(subscription.tier)}`
      );
    }

    return true;
  }

  /**
   * 사용자의 티어가 요구 티어 이상인지 확인
   */
  private hasSufficientTier(
    userTier: SubscriptionTier,
    requiredTier: SubscriptionTier,
  ): boolean {
    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PRO]: 2,
    };

    return tierOrder[userTier] >= tierOrder[requiredTier];
  }

  /**
   * 티어 표시 이름
   */
  private getTierDisplayName(tier: SubscriptionTier): string {
    const names = {
      [SubscriptionTier.FREE]: 'Free',
      [SubscriptionTier.STARTER]: 'Starter',
      [SubscriptionTier.PRO]: 'Pro',
    };
    return names[tier] || tier;
  }
}