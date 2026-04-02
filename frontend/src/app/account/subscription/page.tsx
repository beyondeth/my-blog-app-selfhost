/**
 * 구독 관리 페이지 - Coming Soon
 *
 * FUTURE: 구독제 기능 활성화 시 원래 코드로 복원
 * 원본 파일: frontend/src/app/account/subscription/page.tsx.backup (백업 필요시 생성)
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSubscriptionUiGuard } from '@/hooks/useSubscriptionUiGuard';

export default function SubscriptionManagementPage() {
  const router = useRouter();
  const { canAccess, isRedirecting } = useSubscriptionUiGuard({
    authenticatedRedirectTo: '/settings',
    unauthenticatedRedirectTo: '/',
  });

  useEffect(() => {
    if (!isRedirecting && canAccess) {
      router.replace('/settings/billing');
    }
  }, [canAccess, isRedirecting, router]);

  if (isRedirecting || !canAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return null;
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
