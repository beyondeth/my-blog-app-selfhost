/**
 * Mock 체크아웃 페이지
 * 개발/테스트용으로 실제 결제 없이 구독을 처리하는 페이지
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { SubscriptionTier, BillingCycle } from '@/types/subscription';

/**
 * Mock 체크아웃 페이지 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function MockCheckoutPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [processing, setProcessing] = useState(false);

  const sessionId = searchParams.get('session');
  const tier = searchParams.get('tier') as SubscriptionTier;
  const cycle = searchParams.get('cycle') as BillingCycle;

  /**
   * 결제 완료 시뮬레이션
   * 실제로는 결제 게이트웨이에서 처리
   */
  const handlePayment = async () => {
    setProcessing(true);

    try {
      // 백엔드에 결제 완료 알림 (웹훅 시뮬레이션)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/payment/webhook/mock`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            event: 'checkout.session.completed',
            sessionId,
            tier,
            billingCycle: cycle,
          }),
        }
      );

      if (response.ok) {
        toast.success('구독이 완료되었습니다');
        // 구독 관리 페이지로 이동
        router.push('/account/subscription');
      } else {
        throw new Error('결제 처리 실패');
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('결제 처리 중 오류가 발생했습니다.');
      setProcessing(false);
    }
  };

  /**
   * 결제 취소
   */
  const handleCancel = () => {
    router.push('/pricing');
  };

  // 플랜별 가격 설정 (Mock)
  const getPriceInfo = () => {
    const prices = {
      [SubscriptionTier.FREE]: { monthly: 0, yearly: 0 },
      [SubscriptionTier.STARTER]: { monthly: 900, yearly: 9000 },
      [SubscriptionTier.PRO]: { monthly: 2900, yearly: 29000 },
    };

    const price = cycle === BillingCycle.MONTHLY
      ? prices[tier]?.monthly || 0
      : prices[tier]?.yearly || 0;

    return {
      amount: price,
      display: price === 0 ? '무료' : `₩${price.toLocaleString('ko-KR')}`,
      period: cycle === BillingCycle.MONTHLY ? '월' : '년',
    };
  };

  const priceInfo = getPriceInfo();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            결제 확인
          </h1>
          <p className="text-gray-600">
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
              개발 모드
            </span>
          </p>
        </div>

        {/* 상품 정보 */}
        <div className="border-t border-b py-6 mb-6">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span className="text-gray-600">플랜</span>
              <span className="font-medium text-gray-900">
                {tier === SubscriptionTier.FREE && 'Free'}
                {tier === SubscriptionTier.STARTER && 'Starter'}
                {tier === SubscriptionTier.PRO && 'Pro'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">결제 주기</span>
              <span className="font-medium text-gray-900">
                {cycle === BillingCycle.MONTHLY ? '월간' : '연간'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">금액</span>
              <span className="font-medium text-gray-900">
                {priceInfo.display}/{priceInfo.period}
              </span>
            </div>
          </div>
        </div>

        {/* 안내 메시지 */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>테스트 모드:</strong> 실제 결제는 이루어지지 않습니다.
            "결제하기" 버튼을 클릭하면 구독이 활성화됩니다.
          </p>
        </div>

        {/* 버튼 */}
        <div className="space-y-3">
          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full bg-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? '처리 중...' : '결제하기 (Mock)'}
          </button>
          <button
            onClick={handleCancel}
            disabled={processing}
            className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
        </div>

        {/* 세션 정보 (디버깅용) */}
        {sessionId && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-gray-500">
              Session ID: {sessionId}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mock 체크아웃 페이지 (Suspense 래퍼)
 */
export default function MockCheckoutPage() {
  return (
    <Suspense fallback={null}>
      <MockCheckoutPageContent />
    </Suspense>
  );
}