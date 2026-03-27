/**
 * 구독 관련 React Query hooks
 * 토스페이먼츠 연동 — 실제 API 호출
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
  SubscriptionFeatures,
} from '@/types/subscription';

/**
 * 구독 플랜 목록 조회
 */
export function useSubscriptionPlans() {
  return useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: subscriptionApi.getSubscriptionPlans,
    staleTime: 1000 * 60 * 60, // 1시간
  });
}

/**
 * 특정 구독 플랜 조회
 */
export function useSubscriptionPlan(tier: SubscriptionTier) {
  return useQuery({
    queryKey: ['subscription', 'plans', tier],
    queryFn: () => subscriptionApi.getSubscriptionPlan(tier),
    enabled: !!tier,
    staleTime: 1000 * 60 * 60,
  });
}

/**
 * 현재 사용자의 구독 정보 조회
 */
export function useMySubscription() {
  return useQuery<SubscriptionResponse>({
    queryKey: ['subscription', 'my-subscription'],
    queryFn: subscriptionApi.getMySubscription,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error: any) => {
      if (error?.status === 401) return false;
      return failureCount < 3;
    },
  });
}

/**
 * 체크아웃 세션 생성 (토스 빌링인증 플로우)
 */
export function useCreateCheckout() {
  return useMutation<
    CheckoutSessionResponse,
    Error,
    { tier: SubscriptionTier; billingCycle: BillingCycle; provider?: string }
  >({
    mutationFn: subscriptionApi.createCheckoutSession,
    onSuccess: (data) => {
      if (!data?.checkoutUrl) {
        toast.error('체크아웃 URL을 찾을 수 없습니다');
        return;
      }
      window.location.href = data.checkoutUrl;
    },
    onError: (error) => {
      toast.error(error.message || '결제 처리 중 오류가 발생했습니다');
    },
  });
}

/**
 * 구독 취소
 */
export function useCancelSubscription() {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { immediately?: boolean; reason?: string }
  >({
    mutationFn: subscriptionApi.cancelSubscription,
    onSuccess: () => {
      // toast 제거 — 구독 상태 카드가 자동 갱신되어 UI로 확인 가능
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * 구독 재활성화
 */
export function useResumeSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionApi.resumeSubscription,
    onSuccess: () => {
      // toast 제거 — 구독 상태 카드가 자동 갱신
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

/**
 * 사용량 통계 조회
 */
export function useUsageStats() {
  return useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscriptionApi.getUsageStats,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  });
}

/**
 * 사용량 히스토리 조회
 */
export function useUsageHistory(months: number = 6) {
  return useQuery({
    queryKey: ['subscription', 'usage', 'history', months],
    queryFn: () => subscriptionApi.getUsageHistory(months),
    staleTime: 1000 * 60 * 30,
  });
}

/**
 * 결제 히스토리 조회
 */
export function usePaymentHistory(limit: number = 10) {
  return useQuery({
    queryKey: ['subscription', 'payment-history', limit],
    queryFn: () => subscriptionApi.getPaymentHistory(limit),
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * 등록된 결제 수단 목록 조회
 */
export function usePaymentMethods() {
  return useQuery({
    queryKey: ['subscription', 'payment-methods'],
    queryFn: subscriptionApi.getPaymentMethods,
    staleTime: 1000 * 60 * 10,
  });
}

/**
 * 결제 수단 삭제 (토스 빌링키 비활성화)
 */
export function useDeletePaymentMethod() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: subscriptionApi.deletePaymentMethod,
    onSuccess: () => {
      // toast 제거 — 결제 수단 목록에서 사라지는 것이 피드백
      queryClient.invalidateQueries({ queryKey: ['subscription', 'payment-methods'] });
    },
  });
}

/**
 * 업그레이드 시뮬레이션
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
 * 사용량 제한 체크
 */
export function useCheckUsageLimit(resourceType: string) {
  return useQuery<UsageLimitResponse>({
    queryKey: ['subscription', 'usage', 'check', resourceType],
    queryFn: () => subscriptionApi.checkUsageLimit(resourceType),
    enabled: !!resourceType,
    staleTime: 1000 * 60,
  });
}

/**
 * 기능 접근 가능 여부 체크
 */
export function useCanAccess(feature: keyof SubscriptionFeatures) {
  const { data: subscription } = useMySubscription();

  if (!subscription?.subscription?.plan) {
    return false;
  }

  const features = subscription.subscription.plan.features;
  const value = features[feature];

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (feature === 'analytics') return value !== 'none';

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
