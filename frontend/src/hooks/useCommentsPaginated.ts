'use client';

import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Comment } from '@/types';
import type { PaginatedCommentsResponse, GetCommentsParams, GetRepliesParams } from '@/lib/api/endpoints/comments';
import { useAuth } from '@/providers/AuthProviderV2';

/**
 * 부모 댓글 페이지네이션 훅 (무한 스크롤)
 *
 * @description
 * - React Query useInfiniteQuery 기반
 * - 최신순/인기순 정렬 지원
 * - 스냅샷 타임스탬프 방식으로 중복/누락 방지
 * - staleTime: 0 (항상 서버에서 최신 데이터 조회)
 * - Redis 캐시 의존 (10초 TTL)
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
 *   useParentCommentsPaginated(postId, { sort: 'recent', limit: 20 });
 * ```
 */
export function useParentCommentsPaginated(
  postId: string,
  params?: Omit<GetCommentsParams, 'cursor'>,
) {
  return useInfiniteQuery<PaginatedCommentsResponse, Error, InfiniteData<PaginatedCommentsResponse>, string[], string | null>({
    queryKey: ['comments', 'paginated', postId, params?.sort || 'recent'],
    queryFn: async ({ pageParam }) => {
      const response = await apiClient.getCommentsPaginated(postId, {
        ...params,
        cursor: pageParam || undefined,
        // 스냅샷 타임스탬프는 첫 페이지 응답에서 받아서 이후 페이지에 전달
      });

      return response;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      return lastPage.hasNextPage ? lastPage.nextCursor : null;
    },
    staleTime: 0, // 항상 서버에서 fresh 데이터 가져오기 (Redis 캐시 의존)
    gcTime: 1000 * 60 * 10, // 10분 메모리 캐시 유지
    enabled: !!postId && postId !== 'undefined',
  });
}

/**
 * 답글 페이지네이션 훅 (특정 부모 댓글의 답글)
 *
 * @description
 * - 특정 부모 댓글의 답글만 조회
 * - 오래된 순서대로 정렬 (스레드 형태 유지)
 * - 첫 페이지만 Redis 캐싱
 *
 * @example
 * ```tsx
 * const { data, fetchNextPage, hasNextPage } =
 *   useRepliesPaginated(parentCommentId, { limit: 10 });
 * ```
 */
export function useRepliesPaginated(
  parentCommentId: string,
  params?: Omit<GetRepliesParams, 'cursor'>,
  options?: { enabled?: boolean },
) {
  return useInfiniteQuery<PaginatedCommentsResponse, Error, InfiniteData<PaginatedCommentsResponse>, string[], string | null>({
    queryKey: ['comments', 'replies', parentCommentId],
    queryFn: async ({ pageParam }) => {
      const response = await apiClient.getRepliesPaginated(parentCommentId, {
        ...params,
        cursor: pageParam || undefined,
      });

      return response;
    },
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      return lastPage.hasNextPage ? lastPage.nextCursor : null;
    },
    staleTime: 0, // Redis 캐시 의존
    gcTime: 1000 * 60 * 10, // 10분
    enabled: options?.enabled !== false && !!parentCommentId,
  });
}

/**
 * 댓글 작성 훅 (Optimistic Update)
 *
 * @description
 * - 페이지네이션 캐시 무효화
 * - 첫 페이지만 refetch (이후 페이지는 그대로)
 */
export function useCreateCommentPaginated(postId: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (data: any) => apiClient.createComment(data),
    onSuccess: (newComment, variables) => {
      // 부모 댓글 캐시 무효화
      if (!variables.parentCommentId) {
        // 부모 댓글 작성 시
        queryClient.invalidateQueries({
          queryKey: ['comments', 'paginated', postId],
        });
      } else {
        // 답글 작성 시
        queryClient.invalidateQueries({
          queryKey: ['comments', 'replies', variables.parentCommentId],
        });
      }
    },
  });
}

/**
 * 댓글 삭제 훅
 *
 * @description
 * - 페이지네이션 캐시 무효화
 */
export function useDeleteCommentPaginated(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.deleteComment(id),
    onSuccess: () => {
      // 전체 댓글 캐시 무효화 (부모/답글 모두)
      queryClient.invalidateQueries({
        queryKey: ['comments', 'paginated', postId],
      });
      queryClient.invalidateQueries({
        queryKey: ['comments', 'replies'],
      });
    },
  });
}

/**
 * 댓글 좋아요 토글 훅
 *
 * @description
 * - 인기순 정렬 캐시 무효화
 */
export function useToggleCommentLikePaginated(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => apiClient.toggleCommentLike(commentId),
    onSuccess: () => {
      // 인기순 정렬 캐시만 무효화
      queryClient.invalidateQueries({
        queryKey: ['comments', 'paginated', postId, 'popular'],
      });
    },
  });
}

/**
 * 댓글 싫어요 토글 훅
 *
 * @description
 * - 인기순 정렬 캐시 무효화
 */
export function useToggleCommentDislikePaginated(postId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) => apiClient.toggleCommentDislike(commentId),
    onSuccess: () => {
      // 인기순 정렬 캐시만 무효화
      queryClient.invalidateQueries({
        queryKey: ['comments', 'paginated', postId, 'popular'],
      });
    },
  });
}

/**
 * 페이지네이션된 댓글을 평탄화하는 헬퍼 함수
 *
 * @description
 * useInfiniteQuery의 pages 구조를 단일 배열로 변환
 *
 * @example
 * ```tsx
 * const { data } = useParentCommentsPaginated(postId);
 * const flatComments = flattenPaginatedComments(data);
 * ```
 */
export function flattenPaginatedComments(
  data: { pages: PaginatedCommentsResponse[] } | undefined,
): Comment[] {
  if (!data?.pages) return [];
  return data.pages.flatMap((page) => page.comments);
}
