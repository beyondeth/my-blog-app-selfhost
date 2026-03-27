/**
 * 마켓플레이스 React Query 훅
 */

import {
  useQuery,
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import * as marketplaceApi from '@/services/api/marketplace.service';
import type { BrowseParams } from '@/types/marketplace';

/** 마켓플레이스 상품 목록 (무한 스크롤) */
export function useMarketplaceProducts(params: Omit<BrowseParams, 'cursor'>) {
  return useInfiniteQuery({
    queryKey: ['marketplace', 'products', params],
    queryFn: ({ pageParam }) =>
      marketplaceApi.getMarketplaceProducts({ ...params, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
  });
}

/** 카테고리 목록 + 상품 수 */
export function useMarketplaceCategories() {
  return useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: marketplaceApi.getCategories,
    staleTime: 1000 * 60 * 5,
  });
}

/** 상품 상세 */
export function useProductDetail(slug: string) {
  return useQuery({
    queryKey: ['marketplace', 'product', slug],
    queryFn: () => marketplaceApi.getProductDetail(slug),
    enabled: !!slug,
    staleTime: 1000 * 60 * 2,
  });
}

/** 구매 준비 (주문 생성) */
export function usePreparePurchase() {
  return useMutation({
    mutationFn: marketplaceApi.preparePurchase,
    onError: (error: Error) => {
      toast.error(error.message || '구매 준비에 실패했습니다');
    },
  });
}

/** 구매 확인 (결제 승인) */
export function useConfirmPurchase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: marketplaceApi.confirmPurchase,
    onSuccess: () => {
      // toast 제거 — success 페이지에서 결과 확인
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
    },
  });
}

/** 내 환불 요청 내역 */
export function useMyRefundRequests() {
  return useQuery({
    queryKey: ['marketplace', 'refund-requests'],
    queryFn: marketplaceApi.getMyRefundRequests,
    staleTime: 1000 * 60 * 2,
  });
}

/** 내 구매 내역 */
export function useMyPurchases(limit = 20) {
  return useQuery({
    queryKey: ['marketplace', 'purchases', limit],
    queryFn: () => marketplaceApi.getMyPurchases(limit),
    staleTime: 1000 * 60 * 5,
  });
}
