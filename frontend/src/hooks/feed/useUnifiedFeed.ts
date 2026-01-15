'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  getUnifiedFeed,
  FeedFilterType,
  FeedSortType,
  UnifiedFeedResponse,
} from '@/services/api/feed.service';

/**
 * useUnifiedFeed 훅 옵션
 */
interface UseUnifiedFeedOptions {
  filter?: FeedFilterType;
  sort?: FeedSortType;
  limit?: number;
  enabled?: boolean;
}

/**
 * 통합 피드 조회 훅
 *
 * @description 블로그 포스트와 커뮤니티 포스트를 통합한 무한 스크롤 피드
 *
 * **특징:**
 * - React Query 기반 무한 스크롤
 * - 커서 기반 페이지네이션
 * - 자동 캐싱 및 재시도
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useUnifiedFeed({
 *   filter: 'all',
 *   sort: 'recent',
 * });
 *
 * // 모든 아이템 플랫하게 조회
 * const items = data?.pages.flatMap(page => page.items) ?? [];
 * ```
 */
export function useUnifiedFeed(options: UseUnifiedFeedOptions = {}) {
  const { filter = 'all', sort = 'recent', limit = 20, enabled = true } = options;

  return useInfiniteQuery<UnifiedFeedResponse>({
    queryKey: ['unified-feed', filter, sort, limit],
    queryFn: async ({ pageParam }) => {
      return getUnifiedFeed({
        cursor: pageParam as string | undefined,
        limit,
        filter,
        sort,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      // hasMore가 false이면 더 이상 데이터 없음
      if (!lastPage.hasMore) return undefined;
      return lastPage.nextCursor ?? undefined;
    },
    enabled,
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
  });
}

/**
 * 피드 쿼리 키 생성 유틸리티
 */
export const feedQueryKeys = {
  all: ['unified-feed'] as const,
  filtered: (filter: FeedFilterType, sort: FeedSortType) =>
    ['unified-feed', filter, sort] as const,
};
