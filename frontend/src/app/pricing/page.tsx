/**
 * 구독 요금제 페이지
 * 3가지 플랜 (Free, Starter, Pro)을 카드 형태로 표시
 * 사용자의 현재 구독 상태에 따라 적절한 액션 표시
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiCheck } from 'react-icons/fi';
import { SUBSCRIPTION_INTERNAL_NOTICE } from '@/lib/subscription-access';
import { useSubscriptionUiGuard } from '@/hooks/useSubscriptionUiGuard';
import { useMySubscription, useSubscriptionPlans, useSimulateUpgrade } from '@/hooks/useSubscription';
import { useTossPayments } from '@/hooks/useTossPayments';
import { requestTossBillingAuth, scheduleDowngrade, upgradeSubscription } from '@/services/api/subscription.service';
import { SubscriptionTier, BillingCycle, SubscriptionPlan } from '@/types/subscription';
import { toast } from 'sonner';

export default function PricingPage() {
  const router = useRouter();
  const { user, authStatus, isAdmin, canAccess, isRedirecting } = useSubscriptionUiGuard();
  const { data: plansData, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: subscription } = useMySubscription();
  const { requestBillingAuth } = useTossPayments();
  const [selectedBilling, setSelectedBilling] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const [processingTier, setProcessingTier] = useState<SubscriptionTier | null>(null);
  const simulateUpgrade = useSimulateUpgrade();
  const [upgradePreview, setUpgradePreview] = useState<any>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradingTier, setUpgradingTier] = useState<SubscriptionTier | null>(null);

  // 현재 사용자의 구독 정보
  const currentTier = subscription?.subscription?.tier || SubscriptionTier.FREE;
  const currentStatus = (subscription?.subscription?.status || 'active').toLowerCase();
  const isCanceled = currentStatus === 'canceled' || currentStatus === 'cancelled';

  // 티어 순서 (비교용)
  const tierOrder: Record<string, number> = {
    [SubscriptionTier.FREE]: 0,
    [SubscriptionTier.STARTER]: 1,
    [SubscriptionTier.PRO]: 2,
  };

  /**
   * 구독 버튼 클릭 핸들러
   * - 미로그인: 로그인 페이지 이동
   * - 동일 플랜: 안내 메시지
   * - 다운그레이드: 결제 없이 다음 주기부터 적용 예약
   * - 업그레이드/신규 가입: 토스 결제창으로 이동
   */
  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (processingTier) return;

    if (!user) {
      router.push('/login?redirect=/pricing');
      return;
    }

    // FREE 선택 시
    if (tier === SubscriptionTier.FREE) {
      if (currentTier === SubscriptionTier.FREE) {
        toast.info('이미 Free 플랜을 사용 중입니다.');
        return;
      }
      // 이미 취소된 구독이면 기간 끝나면 자동 FREE 전환 — 추가 액션 불필요
      if (isCanceled) {
        toast.info('이미 구독이 취소되었습니다. 현재 기간 종료 후 자동으로 Free 플랜으로 전환됩니다.');
        return;
      }
      // 활성 유료 구독 → FREE 다운그레이드 (구독 취소와 동일)
      setProcessingTier(tier);
      try {
        const result = await scheduleDowngrade({ tier: 'free' });
        // toast 제거 — billing 페이지의 구독 상태 카드에서 변경 확인
        router.push('/settings/billing');
      } catch (error: any) {
        toast.error(error?.message || '다운그레이드 요청에 실패했습니다.');
      } finally {
        setProcessingTier(null);
      }
      return;
    }

    if (currentTier === tier && !isCanceled) {
      toast.info('이미 해당 플랜을 구독 중입니다.');
      return;
    }

    setProcessingTier(tier);

    try {
      const isDowngrade = !isCanceled && tierOrder[currentTier] > tierOrder[tier];

      if (isDowngrade) {
        // ── 다운그레이드: 결제 없이 예약 ──
        const result = await scheduleDowngrade({
          tier,
          billingCycle: selectedBilling,
        });
        // toast 제거 — billing 페이지의 구독 상태 카드에서 변경 확인
        router.push('/settings/billing');
        return;
      }

      // ── 업그레이드: 기존 빌링키가 있으면 비례배분 확인 모달, 없으면 토스 결제창 ──
      const isUpgrade = !isCanceled && tierOrder[currentTier] < tierOrder[tier] && currentTier !== SubscriptionTier.FREE;

      if (isUpgrade) {
        // 비례배분 시뮬레이션 조회
        try {
          const simResult = await simulateUpgrade.mutateAsync({ tier, billingCycle: selectedBilling });
          setUpgradePreview(simResult);
          setUpgradingTier(tier);
          setShowUpgradeModal(true);
          return; // 모달에서 확인 후 진행
        } catch {
          // 시뮬레이션 실패 → 기존 플로우로 폴백
        }
      }

      // 신규 가입 또는 FREE→유료: 토스 결제창
      const authData = await requestTossBillingAuth(tier, selectedBilling);
      await requestBillingAuth({
        customerKey: authData.customerKey,
        successUrl: authData.successUrl,
        failUrl: authData.failUrl,
      });
      // 토스 결제창으로 리다이렉트됨
    } catch (error: any) {
      if (error?.code === 'USER_CANCEL') {
        toast.info('결제가 취소되었습니다.');
      } else {
        toast.error(error?.message || '결제 처리 중 오류가 발생했습니다.');
      }
    } finally {
      setProcessingTier(null);
    }
  };

  /**
   * 플랜 카드의 버튼 텍스트 결정
   */
  const getButtonText = (tier: SubscriptionTier) => {
    if (processingTier === tier) return '처리 중...';
    if (!user) return '시작하기';

    // 현재 플랜이 취소된 상태
    if (isCanceled) {
      // FREE는 기간 끝나면 자동 전환되므로 "전환 예정"
      if (tier === SubscriptionTier.FREE) return '전환 예정';
      // 같은 플랜 재구독
      if (currentTier === tier) return '재구독';
      // 다른 유료 플랜
      return '구독하기';
    }

    if (currentTier === tier) return '현재 플랜';

    if (tierOrder[currentTier] > tierOrder[tier]) {
      return '다운그레이드 예약';
    }

    return '업그레이드';
  };

  /**
   * 플랜 카드의 버튼 비활성화 여부
   */
  const isButtonDisabled = (tier: SubscriptionTier) => {
    if (!!processingTier) return true;
    // 취소된 구독 + FREE 선택 = 자동 전환 예정이므로 비활성
    if (isCanceled && tier === SubscriptionTier.FREE) return true;
    // 활성 구독에서 현재 플랜 선택 불가
    if (user && currentTier === tier && !isCanceled) return true;
    return false;
  };

  // auth 로딩 중 flicker 방지
  if (isRedirecting || authStatus === 'loading' || plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
      </div>
    );
  }

  if (!canAccess) {
    return null;
  }

  const plans = plansData || [];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 페이지 헤더 */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
            당신의 블로그를 위한 완벽한 플랜
          </h1>
          <p className="mt-4 text-xl text-gray-600 dark:text-gray-400">
            필요에 맞는 플랜을 선택하고 더 많은 기능을 활용하세요
          </p>
        </div>

        {isAdmin && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
            {SUBSCRIPTION_INTERNAL_NOTICE}
          </div>
        )}

        {/* 결제 주기 선택 */}
        <div className="mt-12 flex justify-center">
          <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex space-x-1">
            <button
              onClick={() => setSelectedBilling(BillingCycle.MONTHLY)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedBilling === BillingCycle.MONTHLY
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              월간 결제
            </button>
            <button
              onClick={() => setSelectedBilling(BillingCycle.YEARLY)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedBilling === BillingCycle.YEARLY
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
              }`}
            >
              연간 결제
              <span className="ml-2 text-primary dark:text-blue-400 text-xs font-semibold">17% 할인</span>
            </button>
          </div>
        </div>

        {/* 플랜 카드들 - 모든 카드가 같은 높이를 가지도록 설정 */}
        <div className="mt-16 grid gap-8 lg:grid-cols-3 auto-rows-fr">
          {plans.map((plan: SubscriptionPlan) => {
            const isCurrentPlan = user && currentTier === plan.tier;
            const isPopular = plan.isPopular || false;
            // 선택된 결제 주기에 따른 가격 설정 - 백엔드 데이터 사용
            const price = selectedBilling === BillingCycle.MONTHLY
              ? plan.monthlyPrice || 0
              : plan.yearlyPrice || 0;

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl ${
                  isPopular
                    ? 'border-2 border-blue-500 shadow-xl dark:border-blue-400'
                    : 'border border-gray-200 dark:border-gray-700'
                } bg-white dark:bg-gray-800 p-8 ${isCurrentPlan ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} flex flex-col`}
              >
                {/* 인기 배지 */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-blue-700 dark:from-blue-400 dark:to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      가장 인기
                    </span>
                  </div>
                )}

                {/* 현재 플랜 배지 */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <span className={`${isCanceled ? 'bg-zinc-500' : 'bg-green-600 dark:bg-green-500'} text-white px-3 py-1 rounded-full text-xs font-semibold shadow-lg`}>
                      {isCanceled ? '취소 예정' : '현재 플랜'}
                    </span>
                  </div>
                )}

                {/* 플랜 이름 및 설명 */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {plan.tier === 'free' ? 'Free' : plan.tier === 'starter' ? 'Starter' : plan.tier === 'pro' ? 'Pro' : plan.displayName}
                  </h3>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">
                    {plan.description}
                  </p>
                </div>

                {/* 가격 */}
                <div className="mt-6 text-center">
                  <div className="flex items-baseline justify-center">
                    {price === 0 ? (
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">무료</span>
                    ) : (
                      <>
                        <span className="text-xl font-medium text-gray-500 dark:text-gray-400">₩</span>
                        <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                          {price.toLocaleString('ko-KR')}
                        </span>
                        <span className="ml-2 text-base text-gray-500 dark:text-gray-400">
                          /{selectedBilling === BillingCycle.MONTHLY ? '월' : '년'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 구독 버튼 - 현재 플랜 강조 */}
                <div className="mt-8">
                  <button
                    onClick={(e) => {
                      // 2차 방어: 버튼 클릭 시 중복 방지
                      if (!!processingTier) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                      }
                      handleSubscribe(plan.tier);
                    }}
                    disabled={isButtonDisabled(plan.tier)}
                    className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                      isCurrentPlan
                        ? 'bg-green-600 dark:bg-green-500 text-white cursor-not-allowed shadow-lg'
                        : isPopular
                        ? 'bg-gradient-to-r from-blue-500 to-blue-700 dark:from-blue-400 dark:to-blue-600 text-white hover:from-blue-600 hover:to-blue-800 dark:hover:from-blue-500 dark:hover:to-blue-700'
                        : 'bg-gray-900 dark:bg-gray-700 text-white hover:bg-gray-800 dark:hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {getButtonText(plan.tier)}
                  </button>
                </div>

                {/* 주요 기능 및 제한 사항 컨테이너 - flex-grow로 남은 공간 채우기 */}
                <div className="flex-grow">
                  {/* 주요 기능 */}
                  <div className="mt-8 space-y-4">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">주요 기능</h4>
                    <ul className="space-y-3">
                      {/* highlights 필드 사용 (백엔드 seeder에서 정의된 값) */}
                      {plan.highlights?.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <FiCheck className="w-5 h-5 text-primary dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
                          <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 리소스 제한 정보 - 항상 카드 하단에 위치 */}
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>MCP 자동포스팅</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        월 {plan.features?.maxMcpPostsPerMonth}건
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>일반 포스트</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">무제한</span>
                    </div>
                    <div className="flex justify-between">
                      <span>블로그 수</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {plan.features?.maxBlogCount || 1}개
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>통계 분석</span>
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {plan.features?.analytics === 'none'
                          ? '미제공'
                          : plan.features?.analytics === 'basic'
                          ? '예정'
                          : plan.features?.analytics === 'advanced'
                          ? '예정'
                          : '미제공'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 추가 정보 섹션 */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">자주 묻는 질문</h2>
          <div className="mt-8 max-w-3xl mx-auto">
            <div className="space-y-6">
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">플랜은 언제든지 변경할 수 있나요?</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  네, 언제든지 업그레이드하거나 다운그레이드할 수 있습니다. 변경사항은 다음 결제 주기부터 적용됩니다.
                </p>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">결제는 어떻게 이루어지나요?</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Toss Payments를 통해 안전하게 결제가 이루어집니다. 카드 정보는 토스페이먼츠에서 안전하게 관리됩니다.
                </p>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">취소하면 환불받을 수 있나요?</h3>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  구독 취소 시 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있으며, 이후 자동으로 Free 플랜으로 전환됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 문의 섹션 */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            궁금한 점이 있으신가요?{' '}
            <Link href="/contact" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium">
              문의하기
            </Link>
          </p>
        </div>
      </div>

      {/* ═══ 업그레이드 비례배분 확인 모달 ═══ */}
      {showUpgradeModal && upgradePreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              업그레이드 확인
            </h3>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">현재 플랜</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {upgradePreview.currentPlan?.tier?.toUpperCase()} (₩{(upgradePreview.currentPlan?.price || 0).toLocaleString()}/월)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">변경 플랜</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {upgradePreview.newPlan?.displayName} (₩{(upgradePreview.newPlan?.price || 0).toLocaleString()}/월)
                </span>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">잔여 기간</span>
                  <span className="text-gray-700 dark:text-gray-300">{upgradePreview.remainingDays}일 / {upgradePreview.totalDays}일</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">기존 플랜 잔여가치</span>
                  <span className="text-gray-700 dark:text-gray-300">-₩{(upgradePreview.currentPlan?.remainingValue || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500 dark:text-gray-400">새 플랜 잔여가치</span>
                  <span className="text-gray-700 dark:text-gray-300">₩{(upgradePreview.newPlan?.remainingValue || 0).toLocaleString()}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="flex justify-between">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">지금 결제할 금액</span>
                  <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    ₩{(upgradePreview.proratedAmount || 0).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  다음 결제일부터 ₩{(upgradePreview.newPlan?.price || 0).toLocaleString()}/{upgradePreview.billingCycle === 'yearly' ? '년' : '월'} 청구
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowUpgradeModal(false);
                  setUpgradePreview(null);
                  setUpgradingTier(null);
                  setProcessingTier(null);
                }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  if (!upgradingTier) return;
                  try {
                    const result = await upgradeSubscription({
                      tier: upgradingTier,
                      billingCycle: selectedBilling,
                    });
                    // toast 제거 — billing 페이지로 이동하여 확인
                    setShowUpgradeModal(false);
                    setUpgradePreview(null);
                    setUpgradingTier(null);
                    router.push('/settings/billing');
                  } catch (error: any) {
                    toast.error(error?.message || '업그레이드에 실패했습니다');
                  } finally {
                    setProcessingTier(null);
                  }
                }}
                disabled={!!processingTier && processingTier !== upgradingTier}
                className="flex-1 py-2.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                업그레이드 확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
