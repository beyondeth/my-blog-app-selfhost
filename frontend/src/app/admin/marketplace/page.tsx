'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ShoppingBag, AlertTriangle, TrendingUp, Package, Users, RefreshCw } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

function formatPrice(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

function formatDate(d: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d));
}

async function fetchAdmin(path: string, options?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include', ...options });
  if (!res.ok) throw new Error('API 호출 실패');
  const result = await res.json();
  return result.data || result;
}

const statusLabel: Record<string, string> = {
  paid: '결제 완료', pending: '대기', failed: '실패', refunded: '환불', cancelled: '취소',
};
const refundStatusLabel: Record<string, string> = {
  pending: '대기 중', approved: '승인', rejected: '거부', auto_approved: '자동 승인', processed: '처리 완료',
};

export default function AdminMarketplacePage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'refunds' | 'sellers'>('overview');

  // 통계
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'marketplace', 'stats'],
    queryFn: () => fetchAdmin('/admin/marketplace/stats'),
    staleTime: 1000 * 60,
  });

  // 매출 트렌드
  const { data: analytics } = useQuery({
    queryKey: ['admin', 'marketplace', 'analytics'],
    queryFn: () => fetchAdmin('/admin/marketplace/analytics?days=30'),
    enabled: activeTab === 'overview',
  });

  // 상품
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: ['admin', 'marketplace', 'products'],
    queryFn: () => fetchAdmin('/admin/marketplace/products?limit=50'),
    enabled: activeTab === 'products',
  });

  // 주문
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['admin', 'marketplace', 'orders'],
    queryFn: () => fetchAdmin('/admin/marketplace/orders?limit=50'),
    enabled: activeTab === 'orders',
  });

  // 환불
  const { data: refundsData, isLoading: refundsLoading } = useQuery({
    queryKey: ['admin', 'marketplace', 'refunds'],
    queryFn: () => fetchAdmin('/admin/marketplace/refunds?limit=50'),
    enabled: activeTab === 'refunds',
  });

  // 판매자
  const { data: sellers, isLoading: sellersLoading } = useQuery({
    queryKey: ['admin', 'marketplace', 'sellers'],
    queryFn: () => fetchAdmin('/admin/marketplace/sellers?limit=30'),
    enabled: activeTab === 'sellers',
  });

  // 상품 토글
  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchAdmin(`/admin/marketplace/products/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive, reason: '관리자 조치' }),
      }),
    onSuccess: () => {
      toast.success('상품 상태 변경 완료');
      queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace'] });
    },
  });

  // 환불 강제 승인
  const forceApproveMut = useMutation({
    mutationFn: (id: string) =>
      fetchAdmin(`/admin/marketplace/refunds/${id}/force-approve`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('환불 처리 완료');
      queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace'] });
    },
  });

  // 환불 강제 거부
  const forceRejectMut = useMutation({
    mutationFn: (id: string) =>
      fetchAdmin(`/admin/marketplace/refunds/${id}/force-reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: '관리자 판단에 의한 거부' }),
      }),
    onSuccess: () => {
      toast.success('환불 거부 완료');
      queryClient.invalidateQueries({ queryKey: ['admin', 'marketplace'] });
    },
  });

  const tabs = [
    { key: 'overview', label: '관제 대시보드' },
    { key: 'products', label: '상품 관리' },
    { key: 'orders', label: '주문 내역' },
    { key: 'refunds', label: '환불 관리', badge: stats?.pendingRefunds },
    { key: 'sellers', label: '판매자' },
  ] as const;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white">마켓플레이스 관제</h1>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-zinc-800">
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
            {'badge' in tab && tab.badge ? (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-red-500 text-white rounded-full">
                {tab.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ═══ 관제 대시보드 ═══ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {statsLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <>
              {/* 에스컬레이션 알림 */}
              {stats.escalatedRefunds > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-700 dark:text-red-300">
                    에스컬레이션된 환불 요청이 {stats.escalatedRefunds}건 있습니다 (판매자 7일 무응답)
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard icon={TrendingUp} label="총 거래액" value={`₩${formatPrice(stats.totalRevenue)}`} />
                <StatCard icon={ShoppingBag} label="플랫폼 수익" value={`₩${formatPrice(stats.platformRevenue)}`} />
                <StatCard icon={Package} label="오늘 매출" value={`₩${formatPrice(stats.todayRevenue)}`} sub={`${stats.todayOrders}건`} />
                <StatCard icon={Users} label="판매자" value={`${stats.totalSellers}명`} sub={`상품 ${stats.activeProducts}개`} />
                <StatCard icon={RefreshCw} label="대기 환불" value={`${stats.pendingRefunds}건`} alert={stats.pendingRefunds > 0} />
              </div>

              {/* 매출 트렌드 (텍스트 기반 — 차트 라이브러리 없이) */}
              {analytics && analytics.length > 0 && (
                <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">최근 30일 매출 트렌드</h3>
                  <div className="space-y-1.5">
                    {analytics.slice(-10).map((day: any) => {
                      const maxRevenue = Math.max(...analytics.map((d: any) => d.revenue));
                      const width = maxRevenue > 0 ? (day.revenue / maxRevenue) * 100 : 0;
                      return (
                        <div key={day.date} className="flex items-center gap-3 text-xs">
                          <span className="w-20 text-gray-500 dark:text-zinc-400 shrink-0">
                            {new Date(day.date).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                          </span>
                          <div className="flex-1 h-5 bg-gray-100 dark:bg-zinc-800 rounded overflow-hidden">
                            <div
                              className="h-full bg-gray-900 dark:bg-zinc-300 rounded transition-all"
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          <span className="w-24 text-right text-gray-700 dark:text-zinc-300 shrink-0">
                            ₩{formatPrice(day.revenue)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* ═══ 상품 관리 ═══ */}
      {activeTab === 'products' && (
        <div>
          {productsLoading ? <Loading /> : !productsData?.products?.length ? <Empty label="등록된 상품이 없습니다" /> : (
            <div className="space-y-2">
              {productsData.products.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                      {p.author?.username} · ₩{formatPrice(p.productDetail?.price || 0)} · {p.productDetail?.salesCount || 0}건 판매
                    </p>
                  </div>
                  <button
                    onClick={() => toggleMut.mutate({ id: p.id, isActive: !p.productDetail?.isActive })}
                    className={`text-xs px-3 py-1 rounded-lg ${
                      p.productDetail?.isActive
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}
                  >
                    {p.productDetail?.isActive ? '판매 중' : '비활성'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ 주문 내역 ═══ */}
      {activeTab === 'orders' && (
        <div>
          {ordersLoading ? <Loading /> : !ordersData?.orders?.length ? <Empty label="주문 내역이 없습니다" /> : (
            <div className="space-y-2">
              {ordersData.orders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {o.productPost?.title || '상품'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                      {o.buyer?.username} → {o.seller?.username} · {formatDate(o.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      o.status === 'paid' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                      o.status === 'refunded' ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {statusLabel[o.status] || o.status}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">₩{formatPrice(o.amount)}</span>
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
          {refundsLoading ? <Loading /> : !refundsData?.requests?.length ? <Empty label="환불 요청이 없습니다" /> : (
            <div className="space-y-2">
              {refundsData.requests.map((r: any) => {
                const isEscalated = r.metadata?.escalated;
                return (
                  <div
                    key={r.id}
                    className={`rounded-xl border p-4 ${
                      isEscalated
                        ? 'border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-900/5'
                        : 'border-gray-100 dark:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {r.buyer?.username} → {r.seller?.username}
                          </p>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                            r.status === 'pending' ? 'bg-blue-50 text-blue-700' :
                            r.status === 'processed' ? 'bg-green-50 text-green-700' :
                            r.status === 'rejected' ? 'bg-red-50 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {refundStatusLabel[r.status] || r.status}
                          </span>
                          {isEscalated && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-red-100 text-red-700">에스컬레이션</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                          사유: {r.reason} · ₩{formatPrice(r.order?.amount || 0)} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => forceApproveMut.mutate(r.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => forceRejectMut.mutate(r.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700"
                          >
                            거부
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ 판매자 ═══ */}
      {activeTab === 'sellers' && (
        <div>
          {sellersLoading ? <Loading /> : !sellers?.length ? <Empty label="판매자가 없습니다" /> : (
            <div className="space-y-2">
              {sellers.map((s: any, i: number) => (
                <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-100 dark:border-zinc-800 p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-400 dark:text-zinc-600 w-6">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{s.username}</p>
                      <p className="text-xs text-gray-400 dark:text-zinc-500">
                        상품 {s.productCount}개 · 주문 {s.orderCount}건
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      ₩{formatPrice(s.totalSellerRevenue)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-500">
                      총 거래 ₩{formatPrice(s.totalRevenue)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, alert }: {
  icon: any; label: string; value: string; sub?: string; alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      alert ? 'border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-900/5' : 'border-gray-100 dark:border-zinc-800'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${alert ? 'text-red-500' : 'text-gray-400 dark:text-zinc-500'}`} />
        <span className="text-xs text-gray-500 dark:text-zinc-400">{label}</span>
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Loading() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="text-center py-16">
      <ShoppingBag className="h-10 w-10 text-gray-300 dark:text-zinc-700 mx-auto mb-2" />
      <p className="text-sm text-gray-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
