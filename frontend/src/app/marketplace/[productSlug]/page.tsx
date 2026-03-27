'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, ShoppingBag, ExternalLink, CheckCircle2, Download, List } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/AuthProviderV2';
import { useProductDetail, usePreparePurchase } from '@/hooks/useMarketplace';
import { useTossPayments } from '@/hooks/useTossPayments';
import { getDownloadUrl } from '@/services/api/marketplace.service';
import HtmlContentRenderer from '@/components/ui/content-renderer/HtmlContentRenderer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** 금액 포맷팅 */
function formatPrice(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.productSlug as string;
  const { user } = useAuth();
  const { requestPayment } = useTossPayments();

  const { data: product, isLoading, refetch } = useProductDetail(slug);
  const prepareMut = usePreparePurchase();

  // 환불 모달 상태
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [refundCategory, setRefundCategory] = useState('other');
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  /** 환불 요청 핸들러 */
  const handleRefundRequest = async () => {
    if (!refundReason.trim()) {
      setRefundError('환불 사유를 입력해주세요');
      return;
    }
    if (!product?.id) return;

    setRefundLoading(true);
    setRefundError(null);
    try {
      const res = await fetch(`${API_URL}/marketplace/refund/request`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: product.orderId,
          reason: refundReason,
          reasonCategory: refundCategory,
        }),
      });

      const data = await res.json();
      if (data.success) {
        // toast 제거 — 모달 닫히고 버튼이 "환불 대기 중"으로 자동 전환
        setShowRefundModal(false);
        setRefundReason('');
        setRefundError(null);
        // 상품 상세 재조회하여 refundStatus 반영
        window.location.reload();
      } else {
        const reasons = data.reasons || [];
        setRefundError(reasons.length > 0 ? reasons[0] : (data.message || '환불 요청에 실패했습니다'));
      }
    } catch (error: any) {
      setRefundError(error?.message || '환불 요청에 실패했습니다');
    } finally {
      setRefundLoading(false);
    }
  };

  /** 구매하기 클릭 */
  const handlePurchase = async () => {
    if (!user) {
      router.push(`/login?redirect=/marketplace/${slug}`);
      return;
    }

    if (!product) return;

    try {
      const result = await prepareMut.mutateAsync(product.id);

      // 이미 구매 완료
      if (result.alreadyPurchased) {
        toast.info('이미 구매한 상품입니다');
        router.refresh();
        return;
      }

      // 토스 결제창 열기
      if (result.orderId && result.customerKey && result.successUrl && result.failUrl) {
        await requestPayment({
          orderId: result.orderId,
          orderName: result.orderName || product.title,
          amount: result.amount || product.productDetail.price,
          customerKey: result.customerKey,
          successUrl: result.successUrl,
          failUrl: result.failUrl,
        });
      }
    } catch (error: any) {
      if (error?.code === 'USER_CANCEL') {
        toast.info('결제가 취소되었습니다');
      }
      // 나머지 에러는 usePreparePurchase에서 toast 처리
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0E141B]">
        <div className="mx-auto max-w-4xl px-4 py-8">
          <div className="h-8 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse mb-6" />
          <div className="h-64 bg-gray-100 dark:bg-zinc-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0E141B]">
        <div className="text-center">
          <p className="text-gray-500 dark:text-zinc-400">상품을 찾을 수 없습니다</p>
          <Link href="/marketplace" className="mt-4 inline-block text-sm text-gray-700 dark:text-zinc-300 underline">
            마켓플레이스로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const pd = product.productDetail;
  const supplyAmount = Math.floor(pd.price / 1.1);
  const vatAmount = pd.price - supplyAmount;

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E141B]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        {/* 뒤로가기 */}
        <Link href="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 mb-6">
          <ArrowLeft className="h-4 w-4" />
          마켓플레이스
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 왼쪽: 콘텐츠 */}
          <div className="lg:col-span-2">
            {/* 카테고리 + 제목 */}
            <span className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-wider">
              {pd.categoryLabel}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white leading-tight">
              {product.title}
            </h1>

            {/* 판매자 */}
            {product.author && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-zinc-400">
                  by <span className="font-medium text-gray-700 dark:text-zinc-300">{product.author.username}</span>
                </span>
                {pd.salesCount > 0 && (
                  <span className="text-xs text-gray-400 dark:text-zinc-500">
                    · {pd.salesCount}건 판매
                  </span>
                )}
              </div>
            )}

            {/* Layer 1: 공개 마케팅 설명 (모든 사용자) */}
            {product.descriptionHtml && !product.isFullContent && (
              <div className="mt-8">
                <HtmlContentRenderer content={product.descriptionHtml} />
              </div>
            )}

            {/* Layer 3: 배송 항목 (구매자/소유자 전용) */}
            {product.isFullContent && product.deliveryItems && product.deliveryItems.length > 0 ? (
              <div className="mt-8 space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  구매한 콘텐츠 ({product.deliveryItems.length}개)
                </h3>
                {product.deliveryItems.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-lg border border-gray-200 dark:border-zinc-800 p-4"
                  >
                    {item.type === 'content_html' && item.contentHtml && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-2">{item.label}</p>
                        <HtmlContentRenderer content={item.contentHtml} />
                      </div>
                    )}
                    {item.type === 'file' && (
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.label}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">
                            {item.fileName}
                            {item.fileSize ? ` · ${(item.fileSize / 1024 / 1024).toFixed(1)}MB` : ''}
                          </p>
                        </div>
                        <button
                          onClick={() => toast.info('다운로드 기능이 곧 지원됩니다')}
                          className="flex-shrink-0 ml-3 px-3 py-1.5 text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100"
                        >
                          다운로드
                        </button>
                      </div>
                    )}
                    {item.type === 'external_link' && item.externalUrl && (
                      <a
                        href={item.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between group"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{item.label}</p>
                          <p className="text-xs text-blue-500 group-hover:underline truncate">{item.externalUrl}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 ml-3" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : product.isFullContent && product.content ? (
              // 하위 호환: DeliveryItem이 없는 기존 상품은 content 직접 렌더링
              <div className="mt-8">
                <HtmlContentRenderer content={product.content} />
              </div>
            ) : !product.isFullContent && product.content ? (
              // 미리보기 (미구매 상태)
              <div className="mt-8">
                <HtmlContentRenderer content={product.content} />
                <div className="relative mt-8">
                  <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-[#0E141B] to-transparent h-32 -top-32 pointer-events-none" />
                  <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-8 text-center">
                    <Lock className="h-8 w-8 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                      전체 콘텐츠를 보려면 구매가 필요합니다
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-12 text-center">
                <Lock className="h-10 w-10 text-gray-300 dark:text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  구매 후 콘텐츠를 확인할 수 있습니다
                </p>
              </div>
            )}

            {/* 목차 (미구매자도 전체 구성 파악 가능) */}
            {!product.isFullContent && product.tableOfContents && product.tableOfContents.length > 0 && (
              <div className="mt-6 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <List className="h-4 w-4 text-gray-500 dark:text-zinc-400" />
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">이 상품에 포함된 내용</h3>
                </div>
                <ul className="space-y-1.5">
                  {product.tableOfContents.map((heading, i) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-zinc-400 flex items-start gap-2">
                      <span className="text-gray-400 dark:text-zinc-600 mt-0.5 text-xs">•</span>
                      {heading}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 디지털 파일 다운로드 (구매 완료 + 파일 상품) */}
            {product.isFullContent && pd.deliveryType === 'file' && (
              <div className="mt-6 rounded-xl border border-gray-200 dark:border-zinc-800 p-4">
                <button
                  onClick={async () => {
                    // 구매 주문에서 orderId를 가져와야 하지만, 현재 product detail에는 없으므로
                    // 추후 order 정보를 포함하도록 개선 필요
                    toast.info('다운로드 기능이 곧 지원됩니다');
                  }}
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white hover:underline"
                >
                  <Download className="h-4 w-4" />
                  파일 다운로드
                </button>
              </div>
            )}
          </div>

          {/* 오른쪽: 구매 CTA 사이드바 */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
              {/* 가격 */}
              <div className="text-center mb-5">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  ₩{formatPrice(pd.price)}
                </p>
                <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">
                  공급가 ₩{formatPrice(supplyAmount)} + 부가세 ₩{formatPrice(vatAmount)}
                </p>
              </div>

              {/* 구매 버튼 */}
              {product.hasPurchased ? (
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    구매 완료
                  </div>
                </div>
              ) : product.isOwner ? (
                <div className="text-center py-3 text-sm text-gray-400 dark:text-zinc-500">
                  내 상품
                </div>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={prepareMut.isPending}
                  className="w-full py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:bg-gray-800 dark:hover:bg-zinc-100 transition-colors disabled:opacity-50"
                >
                  {prepareMut.isPending ? '처리 중...' : '구매하기'}
                </button>
              )}

              {/* 환불 상태 표시 (구매 완료 시) */}
              {product.hasPurchased && !product.isOwner && (
                <div className="mt-4">
                  {(product as any).refundStatus === 'pending' || (product as any).refundStatus === 'approved' || (product as any).refundStatus === 'auto_approved' ? (
                    <div className="w-full py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 text-center">
                      환불 대기 중
                    </div>
                  ) : (product as any).refundStatus === 'rejected' ? (
                    <div className="w-full py-2 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs text-red-500 dark:text-red-400 text-center">
                      환불 거부됨
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowRefundModal(true)}
                      className="w-full py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-xs text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      환불 요청
                    </button>
                  )}
                </div>
              )}

              {/* 상품 정보 */}
              <div className="mt-5 pt-5 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">카테고리</span>
                  <span className="text-gray-700 dark:text-zinc-300">{pd.categoryLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">전달 방식</span>
                  <span className="text-gray-700 dark:text-zinc-300">
                    {pd.deliveryType === 'file' ? '파일 다운로드' : '콘텐츠'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-zinc-400">판매 수</span>
                  <span className="text-gray-700 dark:text-zinc-300">{pd.salesCount}건</span>
                </div>
              </div>

              {/* 환불 정책 안내 (법적 의무) */}
              <div className="mt-5 pt-4 border-t border-gray-100 dark:border-zinc-800">
                <p className="text-[11px] text-gray-400 dark:text-zinc-500 leading-relaxed">
                  디지털 콘텐츠 특성상 열람 또는 다운로드 후 환불이 불가합니다
                  (전자상거래법 제17조). 구매 전 미리보기를 확인해주세요.
                  콘텐츠 미열람 시 구매 후 7일 이내 환불 요청이 가능합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ 환불 요청 모달 ═══ */}
      {showRefundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
              환불 요청
            </h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
              디지털 콘텐츠 열람/다운로드 후에는 환불이 불가합니다 (전자상거래법 17조)
            </p>

            {/* 사유 카테고리 */}
            <div className="mb-3">
              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">환불 사유</label>
              <select
                value={refundCategory}
                onChange={(e) => setRefundCategory(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:outline-none"
              >
                <option value="not_as_described">설명과 다른 상품</option>
                <option value="product_defect">상품 결함/불량</option>
                <option value="duplicate_payment">중복 결제</option>
                <option value="other">기타</option>
              </select>
            </div>

            {/* 상세 사유 */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 dark:text-zinc-400 mb-1">상세 사유</label>
              <textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="환불 사유를 구체적으로 입력해주세요"
                rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none resize-none"
              />
            </div>

            {/* 인라인 에러 (toast 대체) */}
            {refundError && (
              <div className="mb-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 text-sm text-red-600 dark:text-red-400">
                {refundError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRefundModal(false); setRefundReason(''); setRefundError(null); }}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300"
              >
                취소
              </button>
              <button
                onClick={handleRefundRequest}
                disabled={refundLoading || !refundReason.trim()}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {refundLoading ? '처리 중...' : '환불 요청'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
