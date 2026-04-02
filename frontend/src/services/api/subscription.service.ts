/**
 * 구독 관련 API 서비스
 * 구독 플랜 조회, 구독 상태 관리, 결제 처리 등을 담당
 */

import { SubscriptionTier, BillingCycle } from '@/types/subscription';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 구독 플랜 목록 조회
 * 모든 사용 가능한 구독 플랜 정보를 가져옴
 */
export async function getSubscriptionPlans() {
  const response = await fetch(`${API_URL}/subscription/plans`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription plans');
  }

  const result = await response.json();
  // API가 { success: true, data: [...] } 형식으로 응답하므로 data 필드 추출
  const plans = result.data || result;

  // pricing 객체를 monthlyPrice와 yearlyPrice로 매핑
  // metadata.highlights를 highlights로 매핑
  return plans.map((plan: any) => ({
    ...plan,
    monthlyPrice: plan.pricing?.monthly || 0,
    yearlyPrice: plan.pricing?.yearly || 0,
    highlights: plan.metadata?.highlights || [],
  }));
}

/**
 * 특정 플랜 상세 정보 조회
 * @param tier - 조회할 플랜 티어 (FREE, STARTER, PRO)
 */
export async function getSubscriptionPlan(tier: SubscriptionTier) {
  const response = await fetch(`${API_URL}/subscription/plans/${tier}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch subscription plan');
  }

  const result = await response.json();
  // API가 { success: true, data: {...} } 형식으로 응답하므로 data 필드 추출
  return result.data || result;
}

/**
 * 현재 사용자의 구독 정보 조회
 * 구독 상태, 만료일, 사용량 등 포함
 */
export async function getMySubscription() {
  const response = await fetch(`${API_URL}/subscription/my-subscription`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      // 로그인하지 않은 경우 null 반환
      return null;
    }
    throw new Error('Failed to fetch subscription');
  }

  const result = await response.json();
  // API가 { success: true, data: {...} } 형식으로 응답하므로 data 필드 추출
  const data = result.data || result;

  // subscription.plan이 있으면 metadata.highlights를 highlights로 매핑
  if (data?.subscription?.plan?.metadata?.highlights) {
    data.subscription.plan.highlights = data.subscription.plan.metadata.highlights;
  }

  return data;
}

/**
 * 구독 체크아웃 세션 생성
 * 결제 페이지로 리다이렉트할 URL 반환
 */
export async function createCheckoutSession(data: {
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
  provider?: string;
}) {
  const response = await fetch(`${API_URL}/subscription/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to create checkout session');
  }

  const result = await response.json();
  // API가 { success: true, data: {...} } 형식으로 응답하므로 data 필드 추출
  return result.data || result;
}

/**
 * 구독 취소
 * @param immediately - true면 즉시 취소, false면 기간 종료 후 취소
 * @param reason - 취소 사유 (선택)
 */
export async function cancelSubscription(data: {
  immediately?: boolean;
  reason?: string;
}) {
  const response = await fetch(`${API_URL}/subscription/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to cancel subscription');
  }

  return response.json();
}

/**
 * 취소된 구독 재활성화
 */
export async function resumeSubscription() {
  const response = await fetch(`${API_URL}/subscription/resume`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to resume subscription');
  }

  return response.json();
}

/**
 * 사용량 통계 조회
 * 현재 월의 사용량과 제한 정보
 */
export async function getUsageStats() {
  const response = await fetch(`${API_URL}/subscription/usage`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null;
    }
    throw new Error('Failed to fetch usage stats');
  }

  return response.json();
}

/**
 * 사용량 히스토리 조회
 * @param months - 조회할 개월 수 (기본 6개월)
 */
export async function getUsageHistory(months: number = 6) {
  const response = await fetch(`${API_URL}/subscription/usage/history?months=${months}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch usage history');
  }

  return response.json();
}

/**
 * 결제 히스토리 조회
 * @param limit - 조회할 결제 건수 (기본 10건)
 */
export async function getPaymentHistory(limit: number = 10) {
  const response = await fetch(`${API_URL}/subscription/payment-history?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch payment history');
  }

  const result = await response.json();
  // API가 { success: true, data: [...] } 형식으로 응답하므로 data 필드 추출
  return result.data || result;
}

/**
 * 플랜 업그레이드 시뮬레이션
 * 실제 결제 없이 변경사항 미리보기
 */
export async function simulateUpgrade(data: {
  tier: SubscriptionTier;
  billingCycle: BillingCycle;
}) {
  const response = await fetch(`${API_URL}/subscription/simulate-upgrade`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to simulate upgrade');
  }

  return response.json();
}

/**
 * 사용자가 특정 리소스를 사용할 수 있는지 체크
 * @param resourceType - 체크할 리소스 타입 (post, blog 등)
 */
export async function checkUsageLimit(resourceType: string) {
  const response = await fetch(`${API_URL}/usage/check/${resourceType}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 403) {
      // 사용량 제한 초과
      const error = await response.json();
      return {
        allowed: false,
        reason: error.message,
        currentUsage: error.currentUsage,
        limit: error.limit,
      };
    }
    throw new Error('Failed to check usage limit');
  }

  const data = await response.json();
  return {
    allowed: true,
    currentUsage: data.currentUsage,
    limit: data.limit,
  };
}

/**
 * 등록된 결제 수단 목록 조회
 */
export async function getPaymentMethods() {
  const response = await fetch(`${API_URL}/subscription/payment-methods`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401) return [];
    throw new Error('결제 수단 조회에 실패했습니다');
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * 결제 수단 삭제 (토스 빌링키 비활성화)
 */
export async function deletePaymentMethod(id: string) {
  const response = await fetch(`${API_URL}/subscription/toss/billing-key/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '결제 수단 삭제에 실패했습니다');
  }

  return response.json();
}

/**
 * 플랜 다운그레이드 예약
 * 현재 결제 기간 종료 후 낮은 플랜으로 자동 전환
 */
export async function scheduleDowngrade(data: {
  tier: string;
  billingCycle?: string;
}) {
  const response = await fetch(`${API_URL}/subscription/schedule-downgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '다운그레이드 요청에 실패했습니다');
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * 업그레이드 실행 (비례배분 차액 결제)
 */
export async function upgradeSubscription(data: {
  tier: string;
  billingCycle: string;
}) {
  const response = await fetch(`${API_URL}/subscription/upgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '업그레이드에 실패했습니다');
  }

  const result = await response.json();
  return result.data || result;
}

/**
 * 다운그레이드 예약 취소
 */
export async function cancelDowngrade() {
  const response = await fetch(`${API_URL}/subscription/cancel-downgrade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '다운그레이드 예약 취소에 실패했습니다');
  }

  const result = await response.json();
  return result.data || result;
}

// ====================================
// 토스페이먼츠 빌링인증 API
// ====================================

/**
 * 토스 빌링인증 요청 파라미터 조회
 * requestBillingAuth()에 필요한 customerKey, successUrl, failUrl 반환
 */
export async function requestTossBillingAuth(
  tier: string,
  billingCycle: "monthly" | "yearly",
): Promise<{
  customerKey: string;
  amount: number;
  orderName: string;
  successUrl: string;
  failUrl: string;
}> {
  const response = await fetch(
    `${API_URL}/subscription/toss/billing-auth`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier, billingCycle }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "빌링인증 요청 실패");
  }

  const result = await response.json();
  return result.data;
}

/**
 * 토스 빌링인증 확인 (빌링키 발급 + 첫 결제)
 */
export async function confirmTossBillingAuth(params: {
  authKey: string;
  customerKey: string;
  tier: string;
  billingCycle: string;
}): Promise<{
  subscription: any;
  paymentKey: string;
  amount: number;
}> {
  const response = await fetch(
    `${API_URL}/subscription/toss/billing-auth/confirm`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "결제 확인 실패");
  }

  const result = await response.json();
  return result.data;
}