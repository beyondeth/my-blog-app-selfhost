'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, ShoppingBag, CreditCard } from 'lucide-react';
import { confirmPurchase } from '@/services/api/marketplace.service';
import type { Order } from '@/types/marketplace';
import { useAuth } from '@/providers/AuthProviderV2';
import { canAccessMarketplacePurchase } from '@/lib/marketplace-access';

/** 금액 포맷팅 */
function formatPrice(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

/** 날짜 포맷팅 (ko-KR) */
function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

/** 카드 번호 마스킹 포맷 (마지막 4자리만 표시) */
function formatCardNumber(number: string): string {
  const digits = number.replace(/[^0-9*]/g, '');
  const last4 = digits.slice(-4);
  return `**** ${last4}`;
}

/**
 * 마켓플레이스 구매 성공 페이지
 * 토스 결제창에서 리다이렉트된 후 결제 승인 처리 + 영수증 표시
 */
export default function PurchaseSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authStatus, isAdmin } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [order, setOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const isProcessing = useRef(false);
  const canAccess = canAccessMarketplacePurchase(isAdmin);

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }

    if (!canAccess) {
      router.replace('/marketplace');
      return;
    }

    const confirm = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');

      if (!paymentKey || !orderId || !amount) {
        setStatus('error');
        setErrorMessage('필수 파라미터가 누락되었습니다');
        return;
      }

      // 중복 호출 방지
      if (isProcessing.current) return;
      isProcessing.current = true;

      // sessionStorage 캐시 체크 (productPost가 포함된 경우만 유효)
      const cacheKey = `mkt_confirm_${orderId}`;
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.productPost?.title) {
            setOrder(parsed);
            setStatus('success');
            return;
          }
          // productPost가 없는 구 캐시 → 무효화
          sessionStorage.removeItem(cacheKey);
        } catch { /* 무시 */ }
      }

      try {
        const result = await confirmPurchase({
          paymentKey,
          orderId,
          amount: Number(amount),
        });

        setOrder(result.order);
        setStatus('success');

        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(result.order));
        } catch { /* 무시 */ }
      } catch (error: unknown) {
        setStatus('error');
        setErrorMessage(
          (error as { message?: string })?.message || '결제 확인에 실패했습니다',
        );
      }
    };

    confirm();
  }, [authStatus, canAccess, router, searchParams]);

  // 카드 정보 추출
  const card = order?.metadata?.card as
    | { issuerCode?: string; cardNumber?: string; cardType?: string; approveNo?: string }
    | null
    | undefined;
  const approvedAt = order?.metadata?.approvedAt as string | undefined;

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0E141B] px-4">
      <div className="max-w-md w-full">
        {authStatus === 'loading' && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-10 h-10 border-3 border-gray-200 dark:border-zinc-700 border-t-gray-900 dark:border-t-zinc-100 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">페이지를 불러오는 중입니다...</p>
          </div>
        )}

        {/* ── 로딩 ── */}
        {authStatus !== 'loading' && status === 'loading' && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-10 h-10 border-3 border-gray-200 dark:border-zinc-700 border-t-gray-900 dark:border-t-zinc-100 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-gray-500 dark:text-zinc-400">결제를 확인하고 있습니다...</p>
          </div>
        )}

        {/* ── 성공 ── */}
        {status === 'success' && order && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            {/* 헤더 */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                구매가 완료되었습니다
              </h2>
            </div>

            {/* 상품 정보 */}
            <div className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 bg-gray-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShoppingBag className="h-4.5 w-4.5 text-gray-500 dark:text-zinc-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {order.productPost?.title || '상품'}
                  </p>
                  {order.seller?.username && (
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {order.seller.username}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 결제 상세 */}
            <div className="px-6 py-4 space-y-3">
              {/* 결제 금액 */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-zinc-400">결제 금액</span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ₩{formatPrice(order.amount)}
                </span>
              </div>

              {/* 결제 수단 */}
              {card && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">결제 수단</span>
                  <span className="flex items-center gap-1.5 text-gray-700 dark:text-zinc-300">
                    <CreditCard className="h-3.5 w-3.5 text-gray-400 dark:text-zinc-500" />
                    {card.cardType || '카드'}
                    {card.cardNumber && (
                      <span className="font-mono text-xs text-gray-400 dark:text-zinc-500">
                        {formatCardNumber(card.cardNumber)}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* 승인 일시 */}
              {approvedAt && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">승인 일시</span>
                  <span className="text-gray-700 dark:text-zinc-300">
                    {formatDate(approvedAt)}
                  </span>
                </div>
              )}

              {/* 주문 번호 */}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-zinc-400">주문 번호</span>
                <span className="text-xs font-mono text-gray-400 dark:text-zinc-500">
                  {order.orderId}
                </span>
              </div>
            </div>

            {/* 영수증 */}
            {order.receiptUrl && (
              <div className="px-6 pb-4">
                <a
                  href={order.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  영수증 보기
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {/* 네비게이션 */}
            <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex gap-3">
              <Link
                href="/marketplace"
                className="flex-1 flex h-10 items-center justify-center rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
              >
                마켓플레이스
              </Link>
              <button
                onClick={() => {
                  const slug = order.productPost?.slug;
                  if (slug) {
                    router.push(`/marketplace/${slug}`);
                  } else {
                    router.back();
                  }
                }}
                className="flex-1 flex h-10 items-center justify-center rounded-lg bg-gray-900 dark:bg-white text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
              >
                상품 보기
              </button>
            </div>
          </div>
        )}

        {/* ── 에러 ── */}
        {status === 'error' && (
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 p-8 text-center">
            <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-red-500 text-lg">&#x2715;</span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              결제 확인 실패
            </h2>
            <p className="text-sm text-red-500 mt-2">{errorMessage}</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-2">
              결제가 이미 처리되었을 수 있습니다. 마켓플레이스에서 구매 내역을 확인해주세요.
            </p>
            <Link
              href="/marketplace"
              className="mt-4 inline-block px-6 py-2 rounded-lg bg-gray-900 dark:bg-white text-sm font-medium text-white dark:text-gray-900"
            >
              마켓플레이스로 돌아가기
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
