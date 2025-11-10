'use client';

import { useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { Comment, User } from '@/types';
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
export function useCreateCommentPaginated(postId: string, sort?: 'newest' | 'oldest' | 'popular') {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const createComment = async (data: any) => {
    // user 유효성 검사 - 1단계 개선으로 이제 항상 user가 있어야 함
    if (!user) {
      throw new Error('로그인이 필요합니다.');
    }

    // 1. Optimistic Update를 위한 임시 댓글 생성
    const optimisticComment: Comment = {
      id: `temp-${Date.now()}-${Math.random()}`,
      content: data.content,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      postId: data.postId,
      parentCommentId: data.parentCommentId || undefined,
      author: user, // useAuth의 user 객체 직접 사용 (신뢰성 보장)
      post: {} as any,
      replies: [],
      likesCount: 0,
      dislikesCount: 0,
      userLiked: false,
      userDisliked: false
    };

    // 2. 캐시 키 (sort와 일치시킴)
    const cacheKey = ['comments', 'paginated', postId, sort || 'newest'];

    // 3. 현재 캐시 데이터 가져오기
    const previousData = queryClient.getQueryData<InfiniteData<PaginatedCommentsResponse>>(cacheKey);

    // 4. Optimistic Update - 임시 댓글 추가
    if (previousData) {
      const updatedData = {
        ...previousData,
        pages: previousData.pages.map((page, pageIndex) => {
          if (pageIndex === 0) {
            // 첫 페이지에 댓글 추가
            const updatedPage = { ...page };

            if (!data.parentCommentId) {
              // 최상위 댓글
              updatedPage.comments = [optimisticComment, ...page.comments];
              updatedPage.totalCount = (page.totalCount || 0) + 1;
            } else {
              // 답글 - 부모 댓글 찾기
              const addReplyToComment = (comments: Comment[]): Comment[] => {
                return comments.map(comment => {
                  if (comment.id === data.parentCommentId) {
                    return {
                      ...comment,
                      replies: [optimisticComment, ...(comment.replies || [])],
                      repliesCount: (comment.repliesCount || 0) + 1
                    };
                  }

                  if (comment.replies) {
                    return {
                      ...comment,
                      replies: addReplyToComment(comment.replies)
                    };
                  }

                  return comment;
                });
              };

              updatedPage.comments = addReplyToComment(updatedPage.comments);
              // 전체 댓글 수도 증가
              updatedPage.totalCount = (page.totalCount || 0) + 1;
            }

            return updatedPage;
          }
          return page;
        })
      };

      // 캐시 업데이트
      queryClient.setQueryData(cacheKey, updatedData);
    }

    try {
      // 5. 서버에 댓글 생성 요청
      const response = await apiClient.createComment(data);

      // 6. 성공 후 실제 데이터로 교체
      queryClient.setQueryData(cacheKey, (old: InfiniteData<PaginatedCommentsResponse> | undefined) => {
        if (!old) return old;

        const updatedData = {
          ...old,
          pages: old.pages.map((page, pageIndex) => {
            if (pageIndex === 0) {
              const updatedPage = { ...page };

              const replaceTempComment = (comments: Comment[]): Comment[] => {
                return comments.map(comment => {
                  // 임시 댓글 찾아서 실제 댓글로 교체
                  if (comment.id.startsWith('temp-') && comment.content === response.content) {
                    return {
                      ...response,
                      replies: [], // 서버에서는 replies가 오지 않으므로 빈 배열로 설정
                      userLiked: false,
                      userDisliked: false
                    };
                  }

                  // 답글인 경우
                  if (comment.replies) {
                    return {
                      ...comment,
                      replies: replaceTempComment(comment.replies)
                    };
                  }

                  return comment;
                });
              };

              updatedPage.comments = replaceTempComment(updatedPage.comments);
              return updatedPage;
            }
            return page;
          })
        };

        return updatedData;
      });

      return response;
    } catch (error) {
      // 7. 에러 시 이전 상태로 롤백
      if (previousData) {
        queryClient.setQueryData(cacheKey, previousData);
      }
      throw error;
    }
  };

  return {
    mutate: createComment,
    mutateAsync: createComment,
  };
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
      // 부모 댓글 캐시 무효화 (인기순)
      queryClient.invalidateQueries({
        queryKey: ['comments', 'paginated', postId, 'popular'],
      });
      // 모든 답글 캐시도 무효화 (좋아요 상태 업데이트)
      queryClient.invalidateQueries({
        queryKey: ['comments', 'replies'],
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
      // 인기순 정렬 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: ['comments', 'paginated', postId, 'popular'],
      });
      // 모든 답글 캐시도 무효화 (싫어요 상태 업데이트)
      queryClient.invalidateQueries({
        queryKey: ['comments', 'replies'],
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
