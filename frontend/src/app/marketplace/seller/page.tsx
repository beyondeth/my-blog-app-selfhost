'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProviderV2';
import { Switch } from '@/components/ui/switch';
import { ShoppingBag, AlertTriangle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function formatPrice(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || 'API 호출 실패');
  }
  const result = await res.json();
  return result.data || result;
}

const orderStatusLabel: Record<string, string> = {
  paid: '결제 완료', pending: '대기', failed: '실패', refunded: '환불', cancelled: '취소',
};

const refundStatusLabel: Record<string, string> = {
  pending: '대기 중', approved: '승인됨', rejected: '거부됨',
  auto_approved: '자동 승인', processed: '환불 완료', escalated: '관리자 처리 중',
};

type TabKey = 'overview' | 'orders' | 'products' | 'refunds';

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // 거부 모달
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // ── 데이터 쿼리 ──
  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['marketplace', 'seller', 'dashboard'],
    queryFn: () => fetchApi('/marketplace/seller/dashboard'),
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  });

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['marketplace', 'seller', 'orders'],
    queryFn: () => fetchApi('/marketplace/seller/orders?limit=30'),
    enabled: !!user && activeTab === 'orders',
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['marketplace', 'seller', 'products'],
    queryFn: () => fetchApi('/marketplace/seller/products'),
    enabled: !!user && activeTab === 'products',
  });

  const { data: refunds, isLoading: refundsLoading } = useQuery({
    queryKey: ['marketplace', 'seller', 'refunds'],
    queryFn: () => fetchApi('/marketplace/refund/seller-requests'),
    enabled: !!user && activeTab === 'refunds',
  });

  // ── 뮤테이션 ──
  const toggleMut = useMutation({
    mutationFn: (postId: string) =>
      fetchApi(`/marketplace/seller/products/${postId}/toggle`, { method: 'PATCH' }),
    onSuccess: () => {
      // toast 제거 — Switch 상태 변화가 피드백
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'seller'] });
    },
  });

  // 환불 처리 에러 상태 (인라인 표시용)
  const [refundError, setRefundError] = useState<string | null>(null);

  const approveMut = useMutation({
    mutationFn: (refundId: string) =>
      fetchApi(`/marketplace/refund/${refundId}/approve`, { method: 'POST' }),
    onSuccess: () => {
      // toast 제거 — 카드 상태 배지가 "환불 완료"로 자동 변경
      setRefundError(null);
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'seller'] });
    },
    onError: (e: Error) => setRefundError(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, response }: { id: string; response: string }) =>
      fetchApi(`/marketplace/refund/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response }),
      }),
    onSuccess: () => {
      // toast 제거 — 카드 상태 배지가 "거부됨"으로 자동 변경
      setRefundError(null);
      setRejectTarget(null);
      setRejectReason('');
      queryClient.invalidateQueries({ queryKey: ['marketplace', 'seller'] });
    },
    onError: (e: Error) => setRefundError(e.message),
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500 dark:text-zinc-400">로그인이 필요합니다</p>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'overview', label: '매출 요약' },
    { key: 'orders', label: '주문 내역' },
    { key: 'products', label: '내 상품' },
    { key: 'refunds', label: '환불 관리', badge: dashboard?.pendingRefunds },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E141B]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-6">판매자 대시보드</h1>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors relative ${
                activeTab === tab.key
                  ? 'border-gray-900 text-gray-900 dark:border-white dark:text-white'
                  : 'border-transparent text-gray-500 dark:text-zinc-400'
              }`}
            >
              {tab.label}
              {tab.badge ? (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {/* ═══ 매출 요약 ═══ */}
        {activeTab === 'overview' && (
          <div>
            {dashLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : dashboard ? (
              <>
                {/* 환불 알림 — 클릭 시 환불 탭 이동 */}
                {dashboard.pendingRefunds > 0 && (
                  <button
                    onClick={() => setActiveTab('refunds')}
                    className="w-full flex items-center gap-2 mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-left"
                  >
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    <span className="text-sm text-red-700 dark:text-red-300">
                      대기 중인 환불 요청이 {dashboard.pendingRefunds}건 있습니다 — 클릭하여 확인
                    </span>
                  </button>
                )}

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="총 매출" value={`₩${formatPrice(dashboard.totalRevenue)}`} />
                  <StatCard label="내 수익" value={`₩${formatPrice(dashboard.totalSellerRevenue)}`} />
                  <StatCard label="이번 달" value={`₩${formatPrice(dashboard.monthlyRevenue)}`} sub={`${dashboard.monthlyOrders}건`} />
                  <StatCard label="등록 상품" value={`${dashboard.productCount}개`} sub={`주문 ${dashboard.totalOrders}건`} />
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ═══ 주문 내역 ═══ */}
        {activeTab === 'orders' && (
          <div>
            {ordersLoading ? <SkeletonList /> : !ordersData?.orders?.length ? (
              <Empty label="주문 내역이 없습니다" />
            ) : (
              <div className="space-y-2">
                {ordersData.orders.map((order: any) => (
                  <div key={order.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{order.productPost?.title || '상품'}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{order.buyer?.username || '구매자'} · {formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={order.status} labels={orderStatusLabel} />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">₩{formatPrice(order.sellerRevenue || 0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ 내 상품 (Switch 컴포넌트 사용) ═══ */}
        {activeTab === 'products' && (
          <div>
            {productsLoading ? <SkeletonList count={3} /> : !products?.length ? (
              <Empty label="등록된 상품이 없습니다" action={{ href: '/new-story', text: '상품 등록하기' }} />
            ) : (
              <div className="space-y-2">
                {products.map((product: any) => (
                  <div key={product.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{product.title}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                        ₩{formatPrice(product.productDetail?.price || 0)} · {product.productDetail?.salesCount || 0}건 판매
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-gray-500 dark:text-zinc-400">
                        {product.productDetail?.isActive ? '판매 중' : '판매 중지'}
                      </span>
                      <Switch
                        checked={product.productDetail?.isActive ?? false}
                        onCheckedChange={() => toggleMut.mutate(product.id)}
                        disabled={toggleMut.isPending}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ 환불 관리 ═══ */}
        {activeTab === 'refunds' && (
          <div>
            {refundsLoading ? <SkeletonList /> : !refunds?.length ? (
              <Empty label="환불 요청이 없습니다" />
            ) : (
              <div className="space-y-3">
                {refunds.map((r: any) => {
                  const isPending = r.status === 'pending';
                  const isEscalated = r.status === 'escalated';

                  return (
                    <div
                      key={r.id}
                      className={`rounded-xl border p-4 ${
                        isEscalated
                          ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/5'
                          : 'border-gray-100 dark:border-zinc-800'
                      }`}
                    >
                      {/* 상단: 구매자 + 상태 */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {r.buyer?.username || '구매자'}
                            </p>
                            <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                              isPending ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
                              r.status === 'processed' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                              r.status === 'rejected' ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' :
                              isEscalated ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {refundStatusLabel[r.status] || r.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                            ₩{formatPrice(r.order?.amount || 0)} · {formatDate(r.createdAt)}
                          </p>
                        </div>
                      </div>

                      {/* 사유 */}
                      <div className="rounded-lg bg-gray-50 dark:bg-zinc-800/50 p-3 mb-3">
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-1">환불 사유</p>
                        <p className="text-sm text-gray-700 dark:text-zinc-300">{r.reason}</p>
                      </div>

                      {/* 거부 응답 (거부된 경우) */}
                      {r.status === 'rejected' && r.sellerResponse && (
                        <div className="rounded-lg bg-red-50/50 dark:bg-red-900/5 p-3 mb-3">
                          <p className="text-xs text-red-500 mb-1">거부 사유</p>
                          <p className="text-sm text-red-600 dark:text-red-400">{r.sellerResponse}</p>
                        </div>
                      )}

                      {/* 액션 버튼 (PENDING만) */}
                      {isPending && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveMut.mutate(r.id)}
                            disabled={approveMut.isPending}
                            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {approveMut.isPending ? '처리 중...' : '환불 승인'}
                          </button>
                          <button
                            onClick={() => setRejectTarget(r.id)}
                            className="flex-1 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                          >
                            거부
                          </button>
                        </div>
                      )}

                      {/* 인라인 에러 (승인/거부 실패 시) */}
                      {refundError && isPending && (
                        <div className="mt-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400">
                          {refundError}
                        </div>
                      )}

                      {/* 에스컬레이션 안내 */}
                      {isEscalated && (
                        <p className="text-xs text-red-500 dark:text-red-400">
                          7일 이상 미응답으로 관리자에게 에스컬레이션되었습니다. 고객센터에서 처리합니다.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ 거부 사유 모달 ═══ */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">환불 거부</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거부 사유를 입력해주세요 (구매자에게 전달됩니다)"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectTarget(null); setRejectReason(''); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) { toast.error('거부 사유를 입력해주세요'); return; }
                  rejectMut.mutate({ id: rejectTarget, response: rejectReason });
                }}
                disabled={rejectMut.isPending || !rejectReason.trim()}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {rejectMut.isPending ? '처리 중...' : '거부 확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── 공통 컴포넌트 ─── */

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
      <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  const cls = status === 'paid' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    : status === 'refunded' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
    : 'bg-gray-100 text-gray-600';
  return <span className={`text-xs px-2 py-0.5 rounded ${cls}`}>{labels[status] || status}</span>;
}

function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function Empty({ label, action }: { label: string; action?: { href: string; text: string } }) {
  return (
    <div className="text-center py-16">
      <ShoppingBag className="h-10 w-10 text-gray-300 dark:text-zinc-700 mx-auto mb-2" />
      <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
      {action && (
        <a href={action.href} className="mt-3 inline-block text-sm text-gray-700 dark:text-zinc-300 underline">{action.text}</a>
      )}
    </div>
  );
}
