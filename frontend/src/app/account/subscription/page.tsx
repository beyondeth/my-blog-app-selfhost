/**
 * 구독 관리 페이지
 * 현재 구독 정보, 사용량, 결제 내역 등을 표시하고 관리
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FiCreditCard, FiCalendar, FiTrendingUp, FiAlertCircle, FiCheck, FiX, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '@/providers/AuthProviderV2';
import {
  useMySubscription,
  useCancelSubscription,
  useResumeSubscription,
  usePaymentHistory,
  useUsageStats,
  useCreateCheckout,
} from '@/hooks/useSubscription';
import { SubscriptionTier, SubscriptionStatus, BillingCycle, PaymentHistory } from '@/types/subscription';
import { toast } from 'sonner';

export default function SubscriptionManagementPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data: subscriptionData, isLoading: subscriptionLoading } = useMySubscription();
  const { data: paymentHistory, isLoading: paymentLoading } = usePaymentHistory(5);
  const { data: usageStats, isLoading: usageLoading } = useUsageStats();
  const cancelSubscription = useCancelSubscription();
  const resumeSubscription = useResumeSubscription();
  const createCheckout = useCreateCheckout();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // 로그인하지 않은 경우 리다이렉트 (로딩이 완료된 후에만)
  useEffect(() => {
    // 로딩이 완료되고 사용자가 없을 때만 리다이렉트
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

  // 구독 정보
  const subscription = subscriptionData?.subscription;
  // MCP 사용량만 추출 (일반 포스트는 무제한이므로 제외)
  const rawUsage = subscriptionData?.usage;
  let usage: any[] = [];

  if (rawUsage) {
    if (Array.isArray(rawUsage)) {
      // 배열 형태인 경우 MCP_POST만 필터링
      usage = rawUsage.filter((stat: any) => stat.resourceType === 'mcp_post');
    } else {
      // 객체 형태인 경우 MCP_POST만 추출
      const usageObj = rawUsage as any;
      if (usageObj.usage?.mcp_post !== undefined) {
        usage.push({
          resourceType: 'mcp_post',
          currentUsage: usageObj.usage.mcp_post || 0,
          limit: usageObj.limits?.mcp_post || 0,
          percentage: usageObj.percentages?.mcp_post || 0
        });
      }
    }
  }

  const currentTier = subscription?.tier || SubscriptionTier.FREE;
  const status = subscription?.status || SubscriptionStatus.ACTIVE;

  /**
   * 구독 취소 처리
   */
  const handleCancelSubscription = async () => {
    if (!cancelReason.trim()) {
      toast.error('취소 사유를 입력해주세요.');
      return;
    }

    setIsCancelling(true);
    try {
      await cancelSubscription.mutateAsync({
        immediately: false, // 기간 종료 후 취소
        reason: cancelReason,
      });
      setShowCancelModal(false);
      setCancelReason('');
      toast.success('구독이 취소되었습니다. 현재 기간이 끝날 때까지 이용 가능합니다.');
    } catch (error) {
      console.error('Cancel subscription error:', error);
      toast.error('구독 취소 중 오류가 발생했습니다.');
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * 구독 재활성화 처리
   */
  const handleResumeSubscription = async () => {
    try {
      await resumeSubscription.mutateAsync();
      toast.success('구독이 재활성화되었습니다.');
    } catch (error) {
      console.error('Resume subscription error:', error);
      toast.error('구독 재활성화 중 오류가 발생했습니다.');
    }
  };

  /**
   * 플랜 변경 처리
   */
  const handleChangePlan = async (tier: SubscriptionTier, billingCycle: BillingCycle) => {
    try {
      await createCheckout.mutateAsync({
        tier,
        billingCycle,
        provider: 'mock',
      });
    } catch (error) {
      console.error('Change plan error:', error);
      toast.error('플랜 변경 중 오류가 발생했습니다.');
    }
  };

  /**
   * 날짜 포맷팅 유틸리티
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  /**
   * 금액 포맷팅 유틸리티
   */
  const formatCurrency = (amount: number) => {
    return `₩${amount.toLocaleString('ko-KR')}`;
  };

  /**
   * 상태 배지 컴포넌트
   */
  const StatusBadge = ({ status }: { status: SubscriptionStatus }) => {
    const statusConfig = {
      [SubscriptionStatus.ACTIVE]: {
        label: '활성',
        className: 'bg-primary/20 text-primary',
      },
      [SubscriptionStatus.CANCELLED]: {
        label: '취소됨',
        className: 'bg-muted text-muted-foreground',
      },
      [SubscriptionStatus.EXPIRED]: {
        label: '만료됨',
        className: 'bg-red-100 text-red-700',
      },
      [SubscriptionStatus.PAST_DUE]: {
        label: '연체',
        className: 'bg-red-100 text-red-700',
      },
      [SubscriptionStatus.TRIALING]: {
        label: '체험 중',
        className: 'bg-blue-100 text-blue-700',
      },
    };

    const config = statusConfig[status] || statusConfig[SubscriptionStatus.ACTIVE];

    return (
      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  if (subscriptionLoading || usageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 페이지 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">구독 관리</h1>
          <p className="mt-2 text-gray-600">구독 플랜, 사용량, 결제 정보를 관리하세요.</p>
        </div>

        {/* 현재 구독 정보 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">현재 구독</h2>
            {subscription && <StatusBadge status={status} />}
          </div>

          {subscription ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">플랜</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {subscription.plan?.displayName || currentTier.toUpperCase()}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">결제 주기</p>
                    <p className="text-lg font-medium text-gray-900">
                      {subscription.billingCycle === BillingCycle.MONTHLY ? '월간' : '연간'} 결제
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500">다음 결제일</p>
                    <p className="text-lg font-medium text-gray-900">
                      <FiCalendar className="inline-block w-4 h-4 mr-2" />
                      {formatDate(subscription.currentPeriodEnd)}
                    </p>
                  </div>

                  {subscription.cancelledAt && (
                    <div className="bg-muted/50 border border-border rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">
                        <FiAlertCircle className="inline-block w-4 h-4 mr-2" />
                        구독이 {formatDate(subscription.currentPeriodEnd)}에 종료됩니다.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-gray-900 mb-3">플랜 기능</p>
                  <ul className="space-y-2">
                    {/* highlights 필드 사용 (pricing 페이지와 동일) */}
                    {subscription.plan?.highlights?.map((feature: string, index: number) => (
                      <li key={index} className="flex items-start text-sm text-gray-700">
                        <FiCheck className="w-4 h-4 text-primary mt-0.5 mr-2 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">현재 Free 플랜을 이용 중입니다.</p>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                플랜 업그레이드
                <FiChevronRight className="ml-2 w-4 h-4" />
              </Link>
            </div>
          )}

          {/* 액션 버튼들 */}
          {subscription && currentTier !== SubscriptionTier.FREE && (
            <div className="mt-6 pt-6 border-t border-gray-200 flex flex-wrap gap-3">
              {status === SubscriptionStatus.CANCELLED ? (
                <button
                  onClick={handleResumeSubscription}
                  disabled={resumeSubscription.isPending}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  구독 재활성화
                </button>
              ) : (
                <>
                  <Link
                    href="/pricing"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    플랜 변경
                  </Link>
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    구독 취소
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* 사용량 통계 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">이번 달 사용량</h2>

          {usage.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6">
              {usage.map((stat: any) => (
                <div key={stat.resourceType} className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-gray-900">
                      MCP 자동포스팅
                    </p>
                    <FiTrendingUp className="w-5 h-5 text-gray-400" />
                  </div>

                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-3xl font-bold text-gray-900">
                      {stat.currentUsage}
                    </span>
                    <span className="text-gray-500">/</span>
                    <span className="text-xl text-gray-600">
                      {stat.limit === -1 ? '무제한' : stat.limit}
                    </span>
                  </div>

                  {stat.limit > 0 && (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            stat.percentage >= 90
                              ? 'bg-destructive'
                              : stat.percentage >= 75
                              ? 'bg-muted-foreground'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-600">
                        {stat.percentage.toFixed(0)}% 사용
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">사용량 정보가 없습니다.</p>
          )}
        </div>

        {/* 결제 내역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">결제 내역</h2>

          {paymentLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : paymentHistory && paymentHistory.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      날짜
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      금액
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      영수증
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentHistory.map((payment: PaymentHistory) => (
                    <tr key={payment.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(payment.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(payment.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 text-xs font-semibold rounded-full ${
                            payment.status === 'succeeded'
                              ? 'bg-primary/20 text-primary'
                              : payment.status === 'failed'
                              ? 'bg-destructive/20 text-destructive'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {payment.status === 'succeeded' ? '성공' : payment.status === 'failed' ? '실패' : '대기'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {payment.invoiceUrl ? (
                          <a
                            href={payment.invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-700"
                          >
                            보기
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-600">결제 내역이 없습니다.</p>
          )}
        </div>
      </div>

      {/* 구독 취소 모달 */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              구독을 취소하시겠습니까?
            </h3>
            <p className="text-gray-600 mb-6">
              구독을 취소해도 현재 결제 기간이 끝날 때까지 서비스를 이용할 수 있습니다.
              이후 자동으로 Free 플랜으로 전환됩니다.
            </p>

            <div className="mb-6">
              <label htmlFor="cancelReason" className="block text-sm font-medium text-gray-700 mb-2">
                취소 사유 (필수)
              </label>
              <textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="구독을 취소하는 이유를 알려주세요..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancelSubscription}
                disabled={isCancelling || !cancelReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isCancelling ? '처리 중...' : '구독 취소'}
              </button>
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={isCancelling}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                돌아가기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}