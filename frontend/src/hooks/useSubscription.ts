/**
 * 구독 관련 React Query hooks
 * 구독 상태 관리, 캐싱, 자동 리페치 등을 처리
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as subscriptionApi from '@/services/api/subscription.service';
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
 */
export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: subscriptionApi.getSubscriptionPlans,
    staleTime: 1000 * 60 * 60, // 1시간
  });
}

/**
 * 특정 구독 플랜 조회 hook
 */
export function useSubscriptionPlan(tier: SubscriptionTier) {
  return useQuery({
    queryKey: ['subscription', 'plans', tier],
    queryFn: () => subscriptionApi.getSubscriptionPlan(tier),
    enabled: !!tier,
    staleTime: 1000 * 60 * 60, // 1시간
  });
}

/**
 * 현재 사용자의 구독 정보 조회 hook
 * 로그인 상태에서만 활성화
 */
export function useMySubscription() {
  return useQuery<SubscriptionResponse>({
    queryKey: ['subscription', 'my-subscription'],
    queryFn: subscriptionApi.getMySubscription,
    staleTime: 1000 * 60 * 5, // 5분
    refetchOnMount: 'always', // 페이지 마운트 시 항상 최신 데이터 가져오기
    retry: (failureCount, error: any) => {
      // 401 에러는 재시도하지 않음 (로그인하지 않은 상태)
      if (error?.status === 401) return false;
      return failureCount < 3;
    },
  });
}

/**
 * 체크아웃 세션 생성 mutation
 * 구독 플랜 선택 후 결제 페이지로 이동
 */
export function useCreateCheckout() {
  const queryClient = useQueryClient();

  return useMutation<
    CheckoutSessionResponse,
    Error,
    { tier: SubscriptionTier; billingCycle: BillingCycle; provider?: string }
  >({
    mutationFn: subscriptionApi.createCheckoutSession,
    onSuccess: (data) => {
      // subscription.service.ts에서 이미 data 필드를 추출해서 반환
      if (!data?.checkoutUrl) {
        toast.error('체크아웃 URL을 찾을 수 없습니다');
        return;
      }

      // Mock checkout 페이지 또는 실제 결제 페이지로 리다이렉트
      // mock-checkout 페이지에서 결제 시뮬레이션 후 웹훅 호출
      if (data.checkoutUrl.includes('mock-checkout')) {
        // Mock 체크아웃 페이지로 이동
        toast.info('결제 페이지로 이동합니다...');
        window.location.href = data.checkoutUrl;
      } else {
        // 실제 결제 페이지로 리다이렉트 (Stripe, Toss 등)
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error) => {
      toast.error(error.message || '결제 처리 중 오류가 발생했습니다');
    },
  });
}

/**
 * 구독 취소 mutation
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { immediately?: boolean; reason?: string }
  >({
    mutationFn: subscriptionApi.cancelSubscription,
    onSuccess: (data) => {
      toast.success(data.message || '구독이 취소되었습니다');
      // 구독 정보 리페치
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (error) => {
      toast.error(error.message || '구독 취소 중 오류가 발생했습니다');
    },
  });
}

/**
 * 구독 재활성화 mutation
 */
export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionApi.resumeSubscription,
    onSuccess: (data) => {
      toast.success(data.message || '구독이 재활성화되었습니다');
      // 구독 정보 리페치
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '구독 재활성화 중 오류가 발생했습니다');
    },
  });
}

/**
 * 사용량 통계 조회 hook
 */
export function useUsageStats() {
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscriptionApi.getUsageStats,
    staleTime: 1000 * 60 * 2, // 2분
    refetchInterval: 1000 * 60 * 5, // 5분마다 리페치
  });
}

/**
 * 사용량 히스토리 조회 hook
 */
export function useUsageHistory(months: number = 6) {
  return useQuery({
    queryKey: ['subscription', 'usage', 'history', months],
    queryFn: () => subscriptionApi.getUsageHistory(months),
    staleTime: 1000 * 60 * 30, // 30분
  });
}

/**
 * 결제 히스토리 조회 hook
 */
export function usePaymentHistory(limit: number = 10) {
  return useQuery({
    queryKey: ['subscription', 'payment-history', limit],
    queryFn: () => subscriptionApi.getPaymentHistory(limit),
    staleTime: 1000 * 60 * 10, // 10분
  });
}

/**
 * 업그레이드 시뮬레이션 hook
 * 실제 결제 없이 변경사항 미리보기
 */
export function useSimulateUpgrade() {
  return useMutation<
    UpgradeSimulation,
    Error,
    { tier: SubscriptionTier; billingCycle: BillingCycle }
  >({
    mutationFn: subscriptionApi.simulateUpgrade,
    onError: (error) => {
      toast.error(error.message || '시뮬레이션 중 오류가 발생했습니다');
    },
  });
}

/**
 * 사용량 제한 체크 hook
 * 리소스 생성 전에 제한 확인
 */
export function useCheckUsageLimit(resourceType: string) {
  return useQuery<UsageLimitResponse>({
    queryKey: ['subscription', 'usage', 'check', resourceType],
    queryFn: () => subscriptionApi.checkUsageLimit(resourceType),
    enabled: !!resourceType,
    staleTime: 1000 * 60, // 1분
  });
}

/**
 * 구독 상태에 따른 기능 접근 가능 여부 체크
 */
export function useCanAccess(feature: keyof SubscriptionFeatures) {
  const { data: subscription } = useMySubscription();

  if (!subscription?.subscription?.plan) {
    return false;
  }

  const features = subscription.subscription.plan.features;
  const value = features[feature];

  // boolean 값인 경우 그대로 반환
  if (typeof value === 'boolean') {
    return value;
  }

  // 숫자인 경우 0보다 큰지 체크
  if (typeof value === 'number') {
    return value > 0;
  }

  // analytics 같은 문자열 값인 경우
  if (feature === 'analytics') {
    return value !== 'none';
  }

  return false;
}

/**
 * 현재 구독 티어 가져오기
 */
export function useCurrentTier(): SubscriptionTier {
  const { data: subscription } = useMySubscription();
  return subscription?.subscription?.tier || SubscriptionTier.FREE;
}

/**
 * 구독 업그레이드 필요 여부 체크
 */
export function useNeedsUpgrade(requiredTier: SubscriptionTier): boolean {
  const currentTier = useCurrentTier();

  const tierOrder = {
    [SubscriptionTier.FREE]: 0,
    [SubscriptionTier.STARTER]: 1,
    [SubscriptionTier.PRO]: 2,
  };

  return tierOrder[currentTier] < tierOrder[requiredTier];
}