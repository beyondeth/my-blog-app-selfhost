import { useInfiniteQuery } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { postQueryKeys } from '@/hooks/usePosts';

/**
 * 홈페이지 전용 포스트 목록 훅
 *
 * @description
 * 홈페이지의 성능 최적화를 위해 별도의 캐시 전략을 사용:
 * - staleTime: 2분 (홈페이지에서만 적용하여 로딩 속도 개선)
 * - refetchOnMount: false (하드 리프레시 시 불필요한 요청 방지)
 * - 다른 페이지들은 기존의 실시간 전략(staleTime: 0) 유지
 */
export function useHomepagePosts(options: {
  search?: string;
  category?: string;
  enabled?: boolean;
} = {}) {
  const { search, category, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: postQueryKeys.list({
      search,
      category,
      page: 'homepage' // 홈페이지임을 식별하는 표식
    }),
    queryFn: ({ pageParam }) => postsAPI.getPostsCursor({
      cursor: pageParam || undefined,
      limit: 20,
      sort: 'recent',
      search,
      category,
    }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
    enabled,
    // 홈페이지 전용 최적화된 캐시 설정
    staleTime: 2 * 60 * 1000, // 2간 데이터 신선도 유지 (로딩 속도 개선)
    gcTime: 10 * 60 * 1000, // 10분간 메모리 캐시 보관
    refetchOnWindowFocus: false, // 홈페이지에서는 포커스 시 리프레치 비활성화
    refetchOnMount: false, // 마운트 시 리프레치 방지 (하드 리프레시 최적화)
    refetchOnReconnect: true, // 오프라인 후 재접속 시는 리프레치
    retry: 1,
  });
}