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
import { useAuth } from '@/providers/AuthProviderV2';
import { useMySubscription, useSubscriptionPlans, useCreateCheckout } from '@/hooks/useSubscription';
import { SubscriptionTier, BillingCycle, SubscriptionPlan } from '@/types/subscription';
import { toast } from 'sonner';

export default function PricingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: plansData, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: subscription } = useMySubscription();
  const createCheckout = useCreateCheckout();
  const [selectedBilling, setSelectedBilling] = useState<BillingCycle>(BillingCycle.MONTHLY);
  const [processingTier, setProcessingTier] = useState<SubscriptionTier | null>(null);

  // 현재 사용자의 구독 티어
  const currentTier = subscription?.subscription?.tier || SubscriptionTier.FREE;

  /**
   * 구독 버튼 클릭 핸들러
   * 로그인하지 않은 경우 로그인 페이지로 이동
   * 로그인한 경우 체크아웃 세션 생성
   */
  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (!user) {
      // 로그인하지 않은 경우 로그인 페이지로 이동
      router.push('/login?redirect=/pricing');
      return;
    }

    // Free 플랜은 체크아웃 필요 없음
    if (tier === SubscriptionTier.FREE) {
      toast.info('Free 플랜은 가입 시 자동으로 적용됩니다.');
      return;
    }

    // 이미 해당 플랜을 구독 중인 경우
    if (currentTier === tier) {
      toast.info('이미 해당 플랜을 구독 중입니다.');
      return;
    }

    // 처리 중 상태 설정
    setProcessingTier(tier);

    try {
      // 체크아웃 세션 생성 및 리다이렉트
      await createCheckout.mutateAsync({
        tier,
        billingCycle: selectedBilling,
        provider: 'mock', // 임시로 mock provider 사용
      });
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('결제 처리 중 오류가 발생했습니다.');
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

    if (currentTier === tier) return '현재 플랜';

    const tierOrder = {
      [SubscriptionTier.FREE]: 0,
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PRO]: 2,
    };

    if (tierOrder[currentTier] > tierOrder[tier]) {
      return '다운그레이드';
    }

    return '업그레이드';
  };

  /**
   * 플랜 카드의 버튼 비활성화 여부
   */
  const isButtonDisabled = (tier: SubscriptionTier) => {
    if (processingTier) return true;
    if (user && currentTier === tier) return true;
    return false;
  };

  if (plansLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  const plans = plansData || [];

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* 페이지 헤더 */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            당신의 블로그를 위한 완벽한 플랜
          </h1>
          <p className="mt-4 text-xl text-gray-600">
            필요에 맞는 플랜을 선택하고 더 많은 기능을 활용하세요
          </p>
        </div>

        {/* 결제 주기 선택 */}
        <div className="mt-12 flex justify-center">
          <div className="bg-gray-100 p-1 rounded-lg flex space-x-1">
            <button
              onClick={() => setSelectedBilling(BillingCycle.MONTHLY)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedBilling === BillingCycle.MONTHLY
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              월간 결제
            </button>
            <button
              onClick={() => setSelectedBilling(BillingCycle.YEARLY)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                selectedBilling === BillingCycle.YEARLY
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              연간 결제
              <span className="ml-2 text-green-600 text-xs font-semibold">17% 할인</span>
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
                    ? 'border-2 border-blue-500 shadow-xl'
                    : 'border border-gray-200'
                } bg-white p-8 ${isCurrentPlan ? 'ring-2 ring-blue-500' : ''} flex flex-col`}
              >
                {/* 인기 배지 */}
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                      가장 인기
                    </span>
                  </div>
                )}

                {/* 현재 플랜 배지 */}
                {isCurrentPlan && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                      현재 플랜
                    </span>
                  </div>
                )}

                {/* 플랜 이름 및 설명 */}
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {plan.tier === 'free' ? 'Free' : plan.tier === 'starter' ? 'Starter' : plan.tier === 'pro' ? 'Pro' : plan.displayName}
                  </h3>
                  <p className="mt-2 text-gray-600">
                    {plan.description}
                  </p>
                </div>

                {/* 가격 */}
                <div className="mt-6 text-center">
                  <div className="flex items-baseline justify-center">
                    {price === 0 ? (
                      <span className="text-3xl font-bold text-gray-900">무료</span>
                    ) : (
                      <>
                        <span className="text-xl font-medium text-gray-500">₩</span>
                        <span className="text-3xl font-bold text-gray-900">
                          {price.toLocaleString('ko-KR')}
                        </span>
                        <span className="ml-2 text-base text-gray-500">
                          /{selectedBilling === BillingCycle.MONTHLY ? '월' : '년'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 구독 버튼 */}
                <div className="mt-8">
                  <button
                    onClick={() => handleSubscribe(plan.tier)}
                    disabled={isButtonDisabled(plan.tier)}
                    className={`w-full py-3 px-6 rounded-lg font-medium transition-all ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isPopular
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {getButtonText(plan.tier)}
                  </button>
                </div>

                {/* 주요 기능 및 제한 사항 컨테이너 - flex-grow로 남은 공간 채우기 */}
                <div className="flex-grow">
                  {/* 주요 기능 */}
                  <div className="mt-8 space-y-4">
                    <h4 className="font-semibold text-gray-900">주요 기능</h4>
                    <ul className="space-y-3">
                      {/* highlights 필드 사용 (백엔드 seeder에서 정의된 값) */}
                      {plan.highlights?.map((feature: string, index: number) => (
                        <li key={index} className="flex items-start">
                          <FiCheck className="w-5 h-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                          <span className="text-gray-700 text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* 리소스 제한 정보 - 항상 카드 하단에 위치 */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>MCP 자동포스팅</span>
                      <span className="font-medium text-gray-900">
                        일 {plan.features?.maxMcpPostsPerDay}건 / 월 {plan.features?.maxMcpPostsPerMonth}건
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>일반 포스트</span>
                      <span className="font-medium text-gray-900">무제한</span>
                    </div>
                    <div className="flex justify-between">
                      <span>블로그 수</span>
                      <span className="font-medium text-gray-900">
                        {plan.features?.maxBlogCount || 1}개
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>통계 분석</span>
                      <span className="font-medium text-gray-900">
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
          <h2 className="text-2xl font-bold text-gray-900">자주 묻는 질문</h2>
          <div className="mt-8 max-w-3xl mx-auto">
            <div className="space-y-6">
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">플랜은 언제든지 변경할 수 있나요?</h3>
                <p className="mt-2 text-gray-600">
                  네, 언제든지 업그레이드하거나 다운그레이드할 수 있습니다. 변경사항은 다음 결제 주기부터 적용됩니다.
                </p>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">결제는 어떻게 이루어지나요?</h3>
                <p className="mt-2 text-gray-600">
                  현재는 테스트 모드로 실제 결제가 이루어지지 않습니다. 추후 Toss Payments를 통해 안전하게 결제할 수 있습니다.
                </p>
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">취소하면 환불받을 수 있나요?</h3>
                <p className="mt-2 text-gray-600">
                  구독 취소 시 현재 결제 주기가 끝날 때까지 서비스를 이용할 수 있으며, 이후 자동으로 Free 플랜으로 전환됩니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 문의 섹션 */}
        <div className="mt-16 text-center">
          <p className="text-gray-600">
            궁금한 점이 있으신가요?{' '}
            <Link href="/contact" className="text-blue-600 hover:text-blue-700 font-medium">
              문의하기
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}