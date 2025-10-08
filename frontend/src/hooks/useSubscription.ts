/**
 * 구독 관련 React Query hooks
 *
 * FUTURE: 구독제 기능 활성화 시 주석 해제
 * 현재는 타입 에러 방지를 위한 더미 구현만 제공
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
// FUTURE: 구독제 활성화 시 주석 해제
// import * as subscriptionApi from '@/services/api/subscription.service';
import {
  SubscriptionTier,
  BillingCycle,
  SubscriptionResponse,
  CheckoutSessionResponse,
  UsageLimitResponse,
  UpgradeSimulation,
  SubscriptionFeatures
} from '@/types/subscription';

/**
 * 구독 플랜 목록 조회 hook
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useSubscriptionPlans() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useQuery({
  //   queryKey: ['subscription', 'plans'],
  //   queryFn: subscriptionApi.getSubscriptionPlans,
  //   staleTime: 1000 * 60 * 60, // 1시간
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: async () => [],
    enabled: false, // 비활성화
  });
}

/**
 * 특정 구독 플랜 조회 hook
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useSubscriptionPlan(tier: SubscriptionTier) {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useQuery({
  //   queryKey: ['subscription', 'plans', tier],
  //   queryFn: () => subscriptionApi.getSubscriptionPlan(tier),
  //   enabled: !!tier,
  //   staleTime: 1000 * 60 * 60, // 1시간
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery({
    queryKey: ['subscription', 'plans', tier],
    queryFn: async () => null,
    enabled: false, // 비활성화
  });
}

/**
 * 현재 사용자의 구독 정보 조회 hook
 * 로그인 상태에서만 활성화
 * React Query 메모리 캐시를 활용하여 로딩 중에도 이전 데이터 표시
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useMySubscription() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const queryClient = useQueryClient();
  //
  // return useQuery<SubscriptionResponse>({
  //   queryKey: ['subscription', 'my-subscription'],
  //   queryFn: subscriptionApi.getMySubscription,
  //   staleTime: 1000 * 60 * 5, // 5분간 fresh (캐시 사용, API 호출 안함)
  //   gcTime: 1000 * 60 * 30, // 30분간 메모리 캐시 유지
  //   refetchOnMount: true, // stale한 경우 마운트 시 자동 refetch (mutation 후 즉시 반영)
  //   refetchOnWindowFocus: false, // 윈도우 포커스 시에도 refetch 방지
  //   // 이전 데이터를 placeholderData로 사용하여 로딩 중에도 표시
  //   placeholderData: (previousData) => previousData,
  //   retry: (failureCount, error: any) => {
  //     // 401 에러는 재시도하지 않음 (로그인하지 않은 상태)
  //     if (error?.status === 401) return false;
  //     return failureCount < 3;
  //   },
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery<SubscriptionResponse>({
    queryKey: ['subscription', 'my-subscription'],
    queryFn: async () => ({} as SubscriptionResponse),
    enabled: false, // 비활성화
  });
}

/**
 * 체크아웃 세션 생성 mutation
 * 구독 플랜 선택 후 결제 페이지로 이동
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useCreateCheckout() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const queryClient = useQueryClient();
  //
  // return useMutation<
  //   CheckoutSessionResponse,
  //   Error,
  //   { tier: SubscriptionTier; billingCycle: BillingCycle; provider?: string }
  // >({
  //   mutationFn: subscriptionApi.createCheckoutSession,
  //   onSuccess: (data) => {
  //     // subscription.service.ts에서 이미 data 필드를 추출해서 반환
  //     if (!data?.checkoutUrl) {
  //       toast.error('체크아웃 URL을 찾을 수 없습니다');
  //       return;
  //     }
  //
  //     // Mock checkout 페이지 또는 실제 결제 페이지로 리다이렉트
  //     // mock-checkout 페이지에서 결제 시뮬레이션 후 웹훅 호출
  //     if (data.checkoutUrl.includes('mock-checkout')) {
  //       // Mock 체크아웃 페이지로 이동
  //       toast.info('결제 페이지로 이동합니다...');
  //       window.location.href = data.checkoutUrl;
  //     } else {
  //       // 실제 결제 페이지로 리다이렉트 (Stripe, Toss 등)
  //       window.location.href = data.checkoutUrl;
  //     }
  //   },
  //   onError: (error) => {
  //     toast.error(error.message || '결제 처리 중 오류가 발생했습니다');
  //   },
  // });

  // 더미 구현 (타입 에러 방지용)
  return useMutation<
    CheckoutSessionResponse,
    Error,
    { tier: SubscriptionTier; billingCycle: BillingCycle; provider?: string }
  >({
    mutationFn: async () => ({} as CheckoutSessionResponse),
    onError: () => {
      toast.error('구독 기능은 준비 중입니다');
    },
  });
}

/**
 * 구독 취소 mutation
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useCancelSubscription() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const queryClient = useQueryClient();
  //
  // return useMutation<
  //   any,
  //   Error,
  //   { immediately?: boolean; reason?: string }
  // >({
  //   mutationFn: subscriptionApi.cancelSubscription,
  //   onSuccess: (data) => {
  //     toast.success(data.message || '구독이 취소되었습니다');
  //     // 구독 정보 리페치
  //     queryClient.invalidateQueries({ queryKey: ['subscription'] });
  //   },
  //   onError: (error) => {
  //     toast.error(error.message || '구독 취소 중 오류가 발생했습니다');
  //   },
  // });

  // 더미 구현 (타입 에러 방지용)
  return useMutation<
    any,
    Error,
    { immediately?: boolean; reason?: string }
  >({
    mutationFn: async () => ({}),
    onError: () => {
      toast.error('구독 기능은 준비 중입니다');
    },
  });
}

/**
 * 구독 재활성화 mutation
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useResumeSubscription() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const queryClient = useQueryClient();
  //
  // return useMutation({
  //   mutationFn: subscriptionApi.resumeSubscription,
  //   onSuccess: (data) => {
  //     toast.success(data.message || '구독이 재활성화되었습니다');
  //     // 구독 정보 리페치
  //     queryClient.invalidateQueries({ queryKey: ['subscription'] });
  //   },
  //   onError: (error: Error) => {
  //     toast.error(error.message || '구독 재활성화 중 오류가 발생했습니다');
  //   },
  // });

  // 더미 구현 (타입 에러 방지용)
  return useMutation({
    mutationFn: async () => ({}),
    onError: () => {
      toast.error('구독 기능은 준비 중입니다');
    },
  });
}

/**
 * 사용량 통계 조회 hook
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useUsageStats() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useQuery({
  //   queryKey: ['subscription', 'usage'],
  //   queryFn: subscriptionApi.getUsageStats,
  //   staleTime: 1000 * 60 * 2, // 2분
  //   refetchInterval: 1000 * 60 * 5, // 5분마다 리페치
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: async () => ({}),
    enabled: false, // 비활성화
  });
}

/**
 * 사용량 히스토리 조회 hook
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useUsageHistory(months: number = 6) {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useQuery({
  //   queryKey: ['subscription', 'usage', 'history', months],
  //   queryFn: () => subscriptionApi.getUsageHistory(months),
  //   staleTime: 1000 * 60 * 30, // 30분
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery({
    queryKey: ['subscription', 'usage', 'history', months],
    queryFn: async () => [],
    enabled: false, // 비활성화
  });
}

/**
 * 결제 히스토리 조회 hook
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function usePaymentHistory(limit: number = 10) {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useQuery({
  //   queryKey: ['subscription', 'payment-history', limit],
  //   queryFn: () => subscriptionApi.getPaymentHistory(limit),
  //   staleTime: 1000 * 60 * 10, // 10분
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery({
    queryKey: ['subscription', 'payment-history', limit],
    queryFn: async () => [],
    enabled: false, // 비활성화
  });
}

/**
 * 업그레이드 시뮬레이션 hook
 * 실제 결제 없이 변경사항 미리보기
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useSimulateUpgrade() {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useMutation<
  //   UpgradeSimulation,
  //   Error,
  //   { tier: SubscriptionTier; billingCycle: BillingCycle }
  // >({
  //   mutationFn: subscriptionApi.simulateUpgrade,
  //   onError: (error) => {
  //     toast.error(error.message || '시뮬레이션 중 오류가 발생했습니다');
  //   },
  // });

  // 더미 구현 (타입 에러 방지용)
  return useMutation<
    UpgradeSimulation,
    Error,
    { tier: SubscriptionTier; billingCycle: BillingCycle }
  >({
    mutationFn: async () => ({} as UpgradeSimulation),
    onError: () => {
      toast.error('구독 기능은 준비 중입니다');
    },
  });
}

/**
 * 사용량 제한 체크 hook
 * 리소스 생성 전에 제한 확인
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useCheckUsageLimit(resourceType: string) {
  // FUTURE: 구독제 활성화 시 주석 해제
  // return useQuery<UsageLimitResponse>({
  //   queryKey: ['subscription', 'usage', 'check', resourceType],
  //   queryFn: () => subscriptionApi.checkUsageLimit(resourceType),
  //   enabled: !!resourceType,
  //   staleTime: 1000 * 60, // 1분
  // });

  // 더미 구현 (타입 에러 방지용)
  return useQuery<UsageLimitResponse>({
    queryKey: ['subscription', 'usage', 'check', resourceType],
    queryFn: async () => ({
      allowed: true, // 제한 없음
      currentUsage: 0,
      limit: -1, // 무제한
    }),
    enabled: false, // 비활성화
  });
}

/**
 * 구독 상태에 따른 기능 접근 가능 여부 체크
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useCanAccess(feature: keyof SubscriptionFeatures) {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const { data: subscription } = useMySubscription();
  //
  // if (!subscription?.subscription?.plan) {
  //   return false;
  // }
  //
  // const features = subscription.subscription.plan.features;
  // const value = features[feature];
  //
  // // boolean 값인 경우 그대로 반환
  // if (typeof value === 'boolean') {
  //   return value;
  // }
  //
  // // 숫자인 경우 0보다 큰지 체크
  // if (typeof value === 'number') {
  //   return value > 0;
  // }
  //
  // // analytics 같은 문자열 값인 경우
  // if (feature === 'analytics') {
  //   return value !== 'none';
  // }
  //
  // return false;

  // 더미 구현 (모든 기능 접근 가능)
  return true;
}

/**
 * 현재 구독 티어 가져오기
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useCurrentTier(): SubscriptionTier {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const { data: subscription } = useMySubscription();
  // return subscription?.subscription?.tier || SubscriptionTier.FREE;

  // 더미 구현 (항상 FREE 티어 반환)
  return SubscriptionTier.FREE;
}

/**
 * 구독 업그레이드 필요 여부 체크
 *
 * FUTURE: 구독제 활성화 시 아래 주석 해제
 */
export function useNeedsUpgrade(requiredTier: SubscriptionTier): boolean {
  // FUTURE: 구독제 활성화 시 주석 해제
  // const currentTier = useCurrentTier();
  //
  // const tierOrder = {
  //   [SubscriptionTier.FREE]: 0,
  //   [SubscriptionTier.STARTER]: 1,
  //   [SubscriptionTier.PRO]: 2,
  // };
  //
  // return tierOrder[currentTier] < tierOrder[requiredTier];

  // 더미 구현 (업그레이드 필요 없음)
  return false;
}

/*
 * FUTURE 복원 가이드:
 *
 * 1. 상단 import 주석 해제:
 *    import * as subscriptionApi from '@/services/api/subscription.service';
 *
 * 2. 각 함수의 FUTURE 주석 블록 해제 및 더미 구현 제거
 *
 * 3. API 서비스 파일 확인:
 *    - frontend/src/services/api/subscription.service.ts
 *    - API 엔드포인트가 모두 활성화되어 있는지 확인
 *
 * 4. 백엔드 엔드포인트 확인:
 *    - GET /api/v1/subscription/plans
 *    - GET /api/v1/subscription/my-subscription
 *    - POST /api/v1/payment/checkout
 *    - POST /api/v1/subscription/cancel
 *    - POST /api/v1/subscription/resume
 *    - GET /api/v1/usage/stats
 *    - GET /api/v1/usage/history
 *    - GET /api/v1/payment/history
 *    - POST /api/v1/subscription/simulate-upgrade
 *    - GET /api/v1/usage/check/:resourceType
 *
 * 5. 백엔드 모듈 활성화:
 *    - backend/src/app.module.ts의 FUTURE 주석 해제
 *    - SubscriptionModule, PaymentModule, UsageModule 등
 *
 * 6. 프론트엔드 페이지 복원:
 *    - frontend/src/app/account/subscription/page.tsx
 *    - 원본 구현으로 교체 (현재는 Coming Soon 페이지)
 */
