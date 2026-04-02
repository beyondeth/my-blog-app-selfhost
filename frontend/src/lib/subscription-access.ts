import { FEATURES } from '@/lib/features';

export const SUBSCRIPTION_INTERNAL_NOTICE =
  '현재 테스트 결제 환경입니다. 관리자 검수 전용 화면이며 일반 사용자에게는 노출되지 않습니다.';

export function canAccessSubscriptionUi(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin) || FEATURES.SUBSCRIPTION;
}
