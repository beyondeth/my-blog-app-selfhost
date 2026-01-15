import { SetMetadata } from "@nestjs/common";
import { SubscriptionTier } from "../../common/enums/subscription.enum";

export const REQUIRED_TIER_KEY = "requiredTier";

/**
 * 특정 구독 티어 이상이 필요한 엔드포인트를 표시하는 데코레이터
 *
 * @example
 * ```typescript
 * @RequiresTier(SubscriptionTier.STARTER)
 * @Post('premium-feature')
 * async premiumFeature() {
 *   // Starter 이상 플랜만 접근 가능
 * }
 * ```
 */
export const RequiresTier = (tier: SubscriptionTier) =>
  SetMetadata(REQUIRED_TIER_KEY, tier);
