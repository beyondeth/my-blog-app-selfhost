/**
 * 구독 관리 페이지 - Coming Soon
 *
 * FUTURE: 구독제 기능 활성화 시 원래 코드로 복원
 * 원본 파일: frontend/src/app/account/subscription/page.tsx.backup (백업 필요시 생성)
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiPackage, FiArrowLeft } from 'react-icons/fi';
import { useAuth } from '@/providers/AuthProviderV2';

export default function SubscriptionManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // 로그인하지 않은 경우 리다이렉트
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/account/subscription');
    }
  }, [user, authLoading, router]);

  // 로그인 체크 중이거나 로그인하지 않은 경우
  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          {/* 아이콘 */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-6">
            <FiPackage className="w-8 h-8 text-blue-600" />
          </div>

          {/* 제목 */}
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            구독 기능 준비 중
          </h1>

          {/* 설명 */}
          <p className="text-gray-600 mb-8">
            더 나은 서비스를 제공하기 위해 구독 기능을 준비하고 있습니다.
            <br />
            곧 다양한 플랜과 함께 찾아뵙겠습니다.
          </p>

          {/* 현재 상태 안내 */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 font-medium mb-1">
              현재 이용 가능한 기능
            </p>
            <p className="text-sm text-blue-700">
              모든 기본 기능을 무료로 이용하실 수 있습니다.
            </p>
          </div>

          {/* 홈으로 돌아가기 버튼 */}
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4 mr-2" />
            홈으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
}

/*
 * FUTURE: 구독제 기능 활성화 시 아래 코드로 복원
 *
 * 원본 구현:
 * - useMySubscription: 현재 구독 정보 조회
 * - useCancelSubscription: 구독 취소 처리
 * - useResumeSubscription: 구독 재활성화 처리
 * - usePaymentHistory: 결제 내역 조회
 * - useUsageStats: 사용량 통계 조회
 * - useCreateCheckout: 플랜 변경 처리
 *
 * 주요 기능:
 * - 현재 구독 플랜 및 상태 표시
 * - 월간/연간 결제 주기 관리
 * - MCP 자동포스팅 사용량 통계 (usage_tracking 테이블)
 * - 플랜 변경 및 구독 취소/재활성화
 * - 결제 내역 테이블 (payment_history 테이블)
 * - 구독 취소 모달 (취소 사유 입력)
 *
 * 데이터베이스:
 * - subscriptions 테이블: 구독 정보
 * - subscription_plans 테이블: 플랜 정보
 * - usage_tracking 테이블: 사용량 추적
 * - payment_history 테이블: 결제 내역
 *
 * API 엔드포인트:
 * - GET /api/v1/subscription/my-subscription
 * - POST /api/v1/subscription/cancel
 * - POST /api/v1/subscription/resume
 * - GET /api/v1/payment/history
 * - GET /api/v1/usage/stats
 * - POST /api/v1/payment/checkout
 */
