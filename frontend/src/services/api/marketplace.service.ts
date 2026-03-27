/**
 * 마켓플레이스 API 서비스
 */

import type {
  BrowseParams,
  MarketplaceListResponse,
  MarketplaceProductDetail,
  CategoryCount,
  PreparePurchaseResponse,
  Order,
} from '@/types/marketplace';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/** 상품 목록 조회 */
export async function getMarketplaceProducts(
  params: BrowseParams,
): Promise<MarketplaceListResponse> {
  const query = new URLSearchParams();
  if (params.cursor) query.set('cursor', params.cursor);
  if (params.limit) query.set('limit', String(params.limit));
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  if (params.sort) query.set('sort', params.sort);
  if (params.priceMin !== undefined) query.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined) query.set('priceMax', String(params.priceMax));

  const response = await fetch(`${API_URL}/marketplace?${query}`, {
    credentials: 'include',
  });

  if (!response.ok) throw new Error('상품 목록 조회에 실패했습니다');
  const result = await response.json();
  return result.data;
}

/** 카테고리 목록 + 상품 수 */
export async function getCategories(): Promise<CategoryCount[]> {
  const response = await fetch(`${API_URL}/marketplace/categories`, { credentials: 'include' });
  if (!response.ok) throw new Error('카테고리 조회에 실패했습니다');
  const result = await response.json();
  return result.data;
}

/** 상품 상세 조회 */
export async function getProductDetail(
  slug: string,
): Promise<MarketplaceProductDetail> {
  const response = await fetch(`${API_URL}/marketplace/products/${slug}`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error('상품 조회에 실패했습니다');
  const result = await response.json();
  return result.data;
}

/** 구매 준비 (주문 생성 + 토스 결제 파라미터) */
export async function preparePurchase(
  productPostId: string,
): Promise<PreparePurchaseResponse> {
  const response = await fetch(`${API_URL}/marketplace/purchase/prepare`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productPostId }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '구매 준비에 실패했습니다');
  }
  const result = await response.json();
  return result.data;
}

/** 구매 확인 (토스 결제 승인) */
export async function confirmPurchase(params: {
  paymentKey: string;
  orderId: string;
  amount: number;
}): Promise<{ order: Order; alreadyPaid: boolean }> {
  const response = await fetch(`${API_URL}/marketplace/purchase/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '결제 확인에 실패했습니다');
  }
  const result = await response.json();
  return result.data;
}

/** 보안 다운로드 URL 발급 (S3 presigned, 1시간 만료, 최대 5회) */
export async function getDownloadUrl(orderId: string): Promise<{
  downloadUrl: string;
  expiresIn: number;
  downloadCount: number;
  maxDownloads: number;
  remainingDownloads: number;
}> {
  const response = await fetch(
    `${API_URL}/marketplace/purchase/download/${orderId}`,
    { credentials: 'include' },
  );
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '다운로드 URL 발급에 실패했습니다');
  }
  const result = await response.json();
  return result.data;
}

/** 내 환불 요청 내역 */
export async function getMyRefundRequests(): Promise<any[]> {
  const response = await fetch(
    `${API_URL}/marketplace/refund/my-requests`,
    { credentials: 'include' },
  );
  if (!response.ok) throw new Error('환불 내역 조회에 실패했습니다');
  const result = await response.json();
  return result.data || [];
}

/** 내 구매 내역 */
export async function getMyPurchases(limit = 20): Promise<Order[]> {
  const response = await fetch(
    `${API_URL}/marketplace/purchase?limit=${limit}`,
    { credentials: 'include' },
  );
  if (!response.ok) throw new Error('구매 내역 조회에 실패했습니다');
  const result = await response.json();
  return result.data;
}
