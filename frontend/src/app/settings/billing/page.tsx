'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SUBSCRIPTION_INTERNAL_NOTICE } from '@/lib/subscription-access';
import { useSubscriptionUiGuard } from '@/hooks/useSubscriptionUiGuard';
import { toast } from 'sonner';
import {
  useMySubscription,
  usePaymentHistory,
  usePaymentMethods,
  useCancelSubscription,
  useResumeSubscription,
  useDeletePaymentMethod,
} from '@/hooks/useSubscription';
import { cancelDowngrade } from '@/services/api/subscription.service';
import { useMyPurchases, useMyRefundRequests } from '@/hooks/useMarketplace';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
  SETTINGS_SECTION_DESCRIPTION_CLASS,
} from '@/app/settings/theme';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PaymentDetailModal from '@/components/settings/billing/PaymentDetailModal';
import type { PaymentHistory } from '@/types/subscription';
import {
  CreditCard,
  ArrowUpRight,
  Trash2,
  FileText,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

/* ─────────────────────── 유틸 함수 ─────────────────────── */

/** 금액 포맷팅 */
function formatAmount(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount);
}

/** 날짜 포맷팅 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }).format(new Date(dateStr));
}

/** 짧은 날짜 */
function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(dateStr));
}

/** 티어 표시 이름 */
function getTierLabel(tier?: string): string {
  const map: Record<string, string> = { free: 'Free', starter: 'Starter', pro: 'Pro' };
  return map[tier?.toLowerCase() || ''] || tier || 'Free';
}

/** 상태 배지 */
function getStatusBadge(status?: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
    trialing: { label: 'Trial', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
    canceled: { label: 'Canceled', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
    cancelled: { label: 'Canceled', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
    past_due: { label: 'Payment failed', cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
    expired: { label: 'Expired', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500' },
  };
  return map[status?.toLowerCase() || ''] || { label: status || '-', cls: 'bg-zinc-100 text-zinc-600' };
}

/** 결제 상태 배지 */
function getPaymentBadge(status?: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    succeeded: { label: 'Paid', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
    failed: { label: 'Failed', cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
    refunded: { label: 'Refunded', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
    pending: { label: 'Pending', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
    partially_refunded: { label: 'Partially refunded', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  };
  return map[status?.toLowerCase() || ''] || { label: status || '-', cls: 'bg-zinc-100 text-zinc-600' };
}

/* ─────────────────────── 메인 페이지 ─────────────────────── */

export default function BillingSettingsPage() {
  const { user, authStatus, isAdmin, canAccess, isRedirecting } = useSubscriptionUiGuard({
    authenticatedRedirectTo: '/settings',
    unauthenticatedRedirectTo: '/',
  });
  const router = useRouter();

  // 데이터
  const { data: subData, isLoading: subLoading } = useMySubscription();
  const { data: paymentMethods, isLoading: pmLoading } = usePaymentMethods();
  const [historyLimit, setHistoryLimit] = useState(5);
  const { data: payments, isLoading: payLoading } = usePaymentHistory(historyLimit);

  // 마켓플레이스 구매 내역 + 환불 요청
  const { data: purchases, isLoading: purchasesLoading } = useMyPurchases();
  const { data: refundRequests, isLoading: refundsLoading } = useMyRefundRequests();

  // 뮤테이션
  const cancelMut = useCancelSubscription();
  const resumeMut = useResumeSubscription();
  const deletePmMut = useDeletePaymentMethod();

  // 다이얼로그
  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistory | null>(null);

  // 구독 정보 추출 — 백엔드 응답은 any이므로 안전하게 접근
  const sub = subData?.subscription as any;
  const usage = subData?.usage as any;
  const tier = (sub?.tier || 'free').toLowerCase();
  const status = (sub?.status || 'active').toLowerCase();
  const isPaid = tier !== 'free';
  const isCanceled = status === 'canceled' || status === 'cancelled';
  const isPastDue = status === 'past_due';

  // 결제 금액 (plan에서 가져오거나 subscription 자체에서)
  const price = sub?.price || (sub?.billingCycle === 'yearly'
    ? (sub?.plan?.pricing?.yearly || sub?.plan?.yearlyPrice || 0)
    : (sub?.plan?.pricing?.monthly || sub?.plan?.monthlyPrice || 0));
  const periodEnd = sub?.currentPeriodEnd || sub?.endDate || sub?.nextBillingDate;

  // 다운그레이드 예약 정보
  const scheduledDowngrade = sub?.metadata?.scheduledDowngrade as { targetTier?: string; scheduledAt?: string } | undefined;
  const [cancelingDowngrade, setCancelingDowngrade] = useState(false);

  /** 다운그레이드 예약 취소 핸들러 */
  const handleCancelDowngrade = async () => {
    setCancelingDowngrade(true);
    try {
      const result = await cancelDowngrade();
      toast.success(result.message || 'Scheduled downgrade canceled.');
      // 구독 데이터 새로고침
      window.location.reload();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to cancel the scheduled downgrade.');
    } finally {
      setCancelingDowngrade(false);
    }
  };

  // 인증 로딩 중 → 빈 화면 (뒤로가기 시 로그인 플리커 방지)
  if (isRedirecting || authStatus === 'loading') return null;

  if (!canAccess) return null;

  if (!user) {
    return (
      <div className={`${SETTINGS_CARD_CLASS} p-8 text-center`}>
        <p className="text-sm text-gray-500 dark:text-gray-400">You need to sign in to view billing settings.</p>
        <button onClick={() => router.push('/login?next=/settings/billing')} className={`${SETTINGS_PRIMARY_BUTTON_CLASS} mt-4`}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between pt-1">
        <div className="space-y-1">
          <h2 className={SETTINGS_SECTION_TITLE_CLASS}>Billing</h2>
          <p className={SETTINGS_SECTION_DESCRIPTION_CLASS}>Manage your subscription, payment methods, and billing history.</p>
        </div>
        <button
          onClick={() => router.push('/marketplace/seller')}
          className={SETTINGS_SUBTLE_BUTTON_CLASS}
        >
          <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
          Seller dashboard
        </button>
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {SUBSCRIPTION_INTERNAL_NOTICE}
        </div>
      )}

      {/* PAST_DUE 경고 */}
      {isPastDue && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Payment failed</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
              Review your payment method or add a new card. Repeated failures may cancel the subscription automatically.
            </p>
          </div>
        </div>
      )}

      {/* ══════════ 구독 상태 ══════════ */}
      <div className={`${SETTINGS_CARD_CLASS} p-6`}>
        <h3 className={`${SETTINGS_SECTION_TITLE_CLASS} mb-4`}>Subscription status</h3>

        {subLoading ? (
          <div className="space-y-3">
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ) : (
          <>
            {/* 플랜명 + 상태 배지 */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {getTierLabel(tier)} plan
              </span>
              {(() => {
                const b = getStatusBadge(status);
                return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${b.cls}`}>{b.label}</span>;
              })()}
            </div>

            {isPaid ? (
              <>
                {/* 상세 정보 */}
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Billing cycle</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                      {sub?.billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">₩{formatAmount(price)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isCanceled ? 'Ends on' : 'Next billing date'}
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{formatDate(periodEnd)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Auto renew</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                      {sub?.autoRenew !== false ? 'ON' : 'OFF'}
                    </p>
                  </div>
                </div>

                {/* 취소 안내 */}
                {isCanceled && periodEnd && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-3 mb-5">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300">
                      Your subscription is canceled. You can keep using the current plan until <strong>{formatDate(periodEnd)}</strong>.
                    </p>
                  </div>
                )}

                {/* 다운그레이드 예약 배너 */}
                {scheduledDowngrade?.targetTier && !isCanceled && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-800/50 bg-blue-50 dark:bg-blue-900/10 p-4 mb-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
                          Plan change scheduled
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Starting with the billing cycle after <strong>{formatDate(periodEnd)}</strong>, your subscription will move to the <strong>{getTierLabel(scheduledDowngrade.targetTier)}</strong> plan.
                          You keep full access to the current {getTierLabel(tier)} plan until then.
                        </p>
                      </div>
                      <button
                        onClick={handleCancelDowngrade}
                        disabled={cancelingDowngrade}
                        className="shrink-0 text-xs font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 underline underline-offset-2 transition-colors disabled:opacity-50"
                      >
                        {cancelingDowngrade ? 'Canceling...' : 'Cancel schedule'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                You are currently on the free plan. Upgrade to unlock more MCP autoposting capacity and advanced features.
              </p>
            )}

            {/* 액션 버튼 */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => router.push('/pricing')} className={SETTINGS_SUBTLE_BUTTON_CLASS}>
                <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
                {isPaid ? 'Change plan' : 'Upgrade'}
              </button>
              {isPaid && !isCanceled && (
                <button
                  onClick={() => setShowCancel(true)}
                  className="inline-flex flex-none min-h-[36px] px-4 py-1.5 text-sm font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-[#121621] border border-red-200 dark:border-red-800/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-all items-center justify-center"
                >
                  Cancel subscription
                </button>
              )}
              {isCanceled && (
                <button onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending} className={SETTINGS_PRIMARY_BUTTON_CLASS}>
                  {resumeMut.isPending ? 'Processing...' : 'Resume subscription'}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* ══════════ 사용량 ══════════ */}
      {isPaid && (
        <div className={`${SETTINGS_CARD_CLASS} p-6`}>
          <h3 className={`${SETTINGS_SECTION_TITLE_CLASS} mb-4`}>Usage this month</h3>
          {subLoading ? (
            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          ) : (() => {
            const mcpUsage = usage?.usage?.mcp_post ?? usage?.usage?.MCP_POST ?? 0;
            const mcpLimit = usage?.limits?.mcp_post ?? usage?.limits?.MCP_POST ?? 30;
            const pct = mcpLimit > 0 ? Math.min((mcpUsage / mcpLimit) * 100, 100) : 0;
            let barColor = 'bg-gray-900 dark:bg-gray-100';
            if (pct >= 90) barColor = 'bg-red-500';
            else if (pct >= 70) barColor = 'bg-zinc-500';

            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-gray-700 dark:text-gray-300">MCP autoposting</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{mcpUsage} / {mcpLimit}</span>
                </div>
                <div className="h-2 w-full bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
                {pct >= 80 && (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                    You have used {Math.round(pct)}% of your limit.
                    {pct >= 100 ? ' Additional posting is restricted until the limit resets.' : ''}
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* ══════════ 결제 수단 ══════════ */}
      <div className={`${SETTINGS_CARD_CLASS} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={SETTINGS_SECTION_TITLE_CLASS}>Payment methods</h3>
          {isPaid && (
            <button
              onClick={() => router.push('/pricing')}
              className={SETTINGS_SUBTLE_BUTTON_CLASS}
            >
              <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
              Update payment method
            </button>
          )}
        </div>

        {pmLoading ? (
          <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
        ) : !paymentMethods || (Array.isArray(paymentMethods) && paymentMethods.length === 0) ? (
          <div className="text-center py-8">
            <CreditCard className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No saved payment methods.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(Array.isArray(paymentMethods) ? paymentMethods : [paymentMethods]).map((pm: any) => (
              <div key={pm.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pm.cardCompany || 'Card'} {pm.cardNumber || ''}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {pm.cardType === 'credit' ? 'Credit card' : pm.cardType === 'check' ? 'Debit card' : pm.cardType || ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteId(pm.id)}
                  className="p-2 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ 결제 내역 ══════════ */}
      <div className={`${SETTINGS_CARD_CLASS} p-6`}>
        <h3 className={`${SETTINGS_SECTION_TITLE_CLASS} mb-4`}>Payment history</h3>

        {payLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !payments || (Array.isArray(payments) && payments.length === 0) ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No payment history yet.</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {(Array.isArray(payments) ? payments : []).map((p: any) => {
                const badge = getPaymentBadge(p.status);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedPayment(p)}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-gray-100 dark:border-zinc-800 p-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {p.description || p.orderName || 'Subscription payment'}
                        </p>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {formatShortDate(p.createdAt || p.paidAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">₩{formatAmount(p.amount || 0)}</span>
                      <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-gray-300 dark:text-zinc-600" />
                    </div>
                  </button>
                );
              })}
            </div>

            {Array.isArray(payments) && payments.length >= historyLimit && (
              <button onClick={() => setHistoryLimit((prev) => prev + 10)}
                className="mt-4 flex items-center justify-center gap-1 w-full py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                <ChevronDown className="h-4 w-4" />Load more
              </button>
            )}
          </>
        )}
      </div>

      {/* ══════════ 마켓플레이스 구매 내역 ══════════ */}
      <div className={`${SETTINGS_CARD_CLASS} p-6`}>
        <h3 className={`${SETTINGS_SECTION_TITLE_CLASS} mb-4`}>Marketplace purchases</h3>

        {purchasesLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !purchases || purchases.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No purchases yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {purchases.map((order: any) => (
              <div
                key={order.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-gray-100 dark:border-zinc-800 p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {order.productPost?.title || 'Product'}
                    </p>
                    {order.status === 'refunded' && (
                      <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Refunded
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    {order.seller?.username || 'Seller'} · {formatShortDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-sm font-medium ${order.status === 'refunded' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-white'}`}>
                    ₩{formatAmount(order.amount || 0)}
                  </span>
                  {order.productPost?.slug && (
                    <a
                      href={`/marketplace/${order.productPost.slug}`}
                      className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 underline underline-offset-2"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ══════════ 환불 요청 내역 ══════════ */}
      <div className={`${SETTINGS_CARD_CLASS} p-6`}>
        <h3 className={`${SETTINGS_SECTION_TITLE_CLASS} mb-4`}>Refund requests</h3>

        {refundsLoading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !refundRequests || refundRequests.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-8 w-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No refund requests.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {refundRequests.map((r: any) => {
              const statusMap: Record<string, { label: string; cls: string }> = {
                pending: { label: 'Pending', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' },
                approved: { label: 'Approved', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
                processed: { label: 'Refunded', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
                rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
                escalated: { label: 'Under review', cls: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
                auto_approved: { label: 'Auto approved', cls: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' },
              };
              const badge = statusMap[r.status] || { label: r.status, cls: 'bg-gray-100 text-gray-600' };

              return (
                <div key={r.id} className="rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {r.order?.productPost?.title || 'Product'}
                        </p>
                        <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Paid amount ₩{formatAmount(r.order?.amount || 0)}
                      </p>
                    </div>
                  </div>

                  {/* 타임라인 */}
                  <div className="mt-3 space-y-1.5 text-xs text-gray-500 dark:text-zinc-400">
                    <p>Requested on: {formatShortDate(r.createdAt)}</p>
                    <p>Reason: {r.reason}</p>

                    {/* 거부 시 판매자 응답 */}
                    {r.status === 'rejected' && r.sellerResponse && (
                      <div className="rounded-lg bg-red-50/50 dark:bg-red-900/5 p-2.5 mt-1">
                        <p className="text-xs text-red-500 dark:text-red-400">
                          Seller response: {r.sellerResponse}
                        </p>
                      </div>
                    )}

                    {/* 환불 완료 시 */}
                    {(r.status === 'processed' || r.status === 'approved') && r.processedAt && (
                      <>
                        <p className="text-green-600 dark:text-green-400">
                          Approved on: {formatShortDate(r.processedAt)}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                          Depending on your card issuer, the refund may take 3-5 business days.
                        </p>
                      </>
                    )}
                  </div>

                  {/* 에스컬레이션 안내 */}
                  {r.status === 'escalated' && (
                    <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                      The seller did not respond, so this request was escalated for review. It may take additional time to process.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 구독 취소 다이얼로그 */}
      <ConfirmDialog
        isOpen={showCancel}
        onClose={() => setShowCancel(false)}
        title="Cancel subscription?"
        description={`You can continue using the service until the current billing period ends on ${formatDate(periodEnd)}.`}
        confirmText="Cancel subscription"
        cancelText="Keep plan"
        isLoading={cancelMut.isPending}
        confirmButtonClassName="!text-red-600 dark:!text-red-400"
        onConfirm={() => {
          cancelMut.mutate(
            { reason: cancelReason || undefined },
            { onSuccess: () => setShowCancel(false) },
          );
        }}
      />

      {/* 카드 삭제 다이얼로그 */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete this payment method?"
        description="After deletion it cannot be used for auto-renewal. If you have an active subscription, the next charge may fail."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deletePmMut.isPending}
        confirmButtonClassName="!text-red-600 dark:!text-red-400"
        onConfirm={() => {
          if (deleteId) {
            deletePmMut.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
          }
        }}
      />

      {/* 결제 상세 모달 */}
      <PaymentDetailModal
        payment={selectedPayment}
        open={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
}
