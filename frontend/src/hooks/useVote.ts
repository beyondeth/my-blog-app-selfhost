'use client';

/**
 * 투표 관련 훅
 *
 * @description Reddit 스타일 Upvote/Downvote 시스템 훅
 * - 블로그 포스트용 투표 기능
 * - 낙관적 업데이트 지원
 * - 로그인 필요 콜백 지원
 */

import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { useAuth } from '@/providers/AuthProviderV2';
import { postQueryKeys } from './usePosts';
import type { Post, VoteType, VoteResponse, VoteTypeEnum } from '@/types';
import { feedQueryKeys } from '@/hooks/feed/useUnifiedFeed';
import type { UnifiedFeedResponse } from '@/services/api/feed.service';

/**
 * 투표 낙관적 업데이트 헬퍼
 * - 현재 투표 상태와 새 투표 타입으로 다음 상태를 계산
 */
function calculateNextVoteState(
  currentVote: VoteType,
  newVoteType: NonNullable<VoteType>,
  currentUpvoteCount: number,
  currentDownvoteCount: number
): {
  nextVote: VoteType;
  upvoteCount: number;
  downvoteCount: number;
} {
  // 같은 투표 클릭 → 취소
  if (currentVote === newVoteType) {
    const upvoteCount =
      newVoteType === 'upvote' ? currentUpvoteCount - 1 : currentUpvoteCount;
    const downvoteCount =
      newVoteType === 'downvote' ? currentDownvoteCount - 1 : currentDownvoteCount;
    return { nextVote: null, upvoteCount, downvoteCount };
  }

  // 투표 없음 → 새 투표 추가
  if (currentVote === null) {
    const upvoteCount =
      newVoteType === 'upvote' ? currentUpvoteCount + 1 : currentUpvoteCount;
    const downvoteCount =
      newVoteType === 'downvote' ? currentDownvoteCount + 1 : currentDownvoteCount;
    return { nextVote: newVoteType, upvoteCount, downvoteCount };
  }

  // 다른 투표로 변경 (upvote ↔ downvote)
  // 기존 투표 제거 + 새 투표 추가
  if (newVoteType === 'upvote') {
    // downvote → upvote: downvote -1, upvote +1
    return {
      nextVote: 'upvote',
      upvoteCount: currentUpvoteCount + 1,
      downvoteCount: currentDownvoteCount - 1,
    };
  } else {
    // upvote → downvote: upvote -1, downvote +1
    return {
      nextVote: 'downvote',
      upvoteCount: currentUpvoteCount - 1,
      downvoteCount: currentDownvoteCount + 1,
    };
  }
}

interface UseVoteOptions {
  /** 로그인이 필요할 때 호출되는 콜백 */
  onRequireLogin?: () => void;
}

/**
 * 블로그 포스트 투표 훅
 *
 * @description
 * - 블로그 포스트에 대한 Upvote/Downvote 기능
 * - 낙관적 업데이트로 즉각적인 UI 반응
 * - 에러 시 자동 롤백
 *
 * @example
 * const { mutate: vote, isPending } = useVote();
 * vote({ postId: 'xxx', voteType: 'upvote' });
 */
export function useVote(options: UseVoteOptions = {}) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      postId,
      voteType,
    }: {
      postId: string;
      voteType: NonNullable<VoteType>;
    }) => {
      // 비로그인 사용자 처리
      if (!user) {
        options.onRequireLogin?.();
        throw new Error('로그인이 필요합니다.');
      }

      return postsAPI.vote(postId, voteType);
    },

    // 낙관적 업데이트: API 호출 전에 UI 먼저 업데이트
    onMutate: async ({ postId, voteType }) => {
      // 1. 진행 중인 쿼리 취소 (병렬 실행)
      await Promise.all([
        queryClient.cancelQueries({ queryKey: postQueryKeys.all }),
        queryClient.cancelQueries({ queryKey: feedQueryKeys.all }),
      ]);

      // 2. 이전 데이터 백업 (롤백용)
      const previousLists = queryClient.getQueriesData({ queryKey: postQueryKeys.lists() });
      const previousDetails = queryClient.getQueriesData({ queryKey: postQueryKeys.details() });
      const previousFeed = queryClient.getQueriesData({ queryKey: feedQueryKeys.all });

      // 3. 목록 캐시 낙관적 업데이트
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => {
              if (!page?.posts) return page;

              return {
                ...page,
                posts: page.posts.map((post: Post) => {
                  if (post.id !== postId) return post;

                  const { nextVote, upvoteCount, downvoteCount } = calculateNextVoteState(
                    post.userVote ?? null,
                    voteType,
                    post.upvoteCount ?? 0,
                    post.downvoteCount ?? 0
                  );

                  return {
                    ...post,
                    userVote: nextVote,
                    upvoteCount,
                    downvoteCount,
                    score: upvoteCount - downvoteCount,
                    // 하위 호환성
                    liked: nextVote === 'upvote',
                    likeCount: upvoteCount,
                  };
                }),
              };
            }),
          };
        }
      );

      // 4. 상세 캐시 낙관적 업데이트
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.details() },
        (oldData: any) => {
          if (!oldData || oldData.id !== postId) return oldData;

          const { nextVote, upvoteCount, downvoteCount } = calculateNextVoteState(
            oldData.userVote ?? null,
            voteType,
            oldData.upvoteCount ?? 0,
            oldData.downvoteCount ?? 0
          );

          return {
            ...oldData,
            userVote: nextVote,
            upvoteCount,
            downvoteCount,
            score: upvoteCount - downvoteCount,
            // 하위 호환성
            liked: nextVote === 'upvote',
            likeCount: upvoteCount,
          };
        }
      );

      // 5. 통합 피드 낙관적 업데이트
      queryClient.setQueriesData(
        { queryKey: feedQueryKeys.all },
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              items: page.items.map(item => {
                if (item.id !== postId) return item;

                const { nextVote, upvoteCount, downvoteCount } = calculateNextVoteState(
                  item.userVote ?? null,
                  voteType,
                  item.upvoteCount ?? item.likeCount ?? 0,
                  item.downvoteCount ?? 0
                );

                return {
                  ...item,
                  userVote: nextVote,
                  upvoteCount,
                  downvoteCount,
                  score: upvoteCount - downvoteCount,
                  liked: nextVote === 'upvote' ? true : undefined,
                  likeCount: upvoteCount,
                };
              }),
            })),
          };
        }
      );

      return { previousLists, previousDetails, previousFeed };
    },

    // 에러 시 롤백
    onError: (error, variables, context) => {
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetails) {
        context.previousDetails.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousFeed) {
        context.previousFeed.forEach(([queryKey, data]: [any, any]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    // 성공 시 서버 응답으로 최종 동기화
    onSuccess: (response: VoteResponse, { postId }) => {
      const { userVote, upvoteCount, downvoteCount, score } = response;

      // 목록 캐시 최종 업데이트
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => {
              if (!page?.posts) return page;

              return {
                ...page,
                posts: page.posts.map((post: Post) =>
                  post.id === postId
                    ? {
                        ...post,
                        userVote,
                        upvoteCount,
                        downvoteCount,
                        score,
                        liked: userVote === 'upvote',
                        likeCount: upvoteCount,
                      }
                    : post
                ),
              };
            }),
          };
        }
      );

      // 상세 캐시 최종 업데이트
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.details() },
        (oldData: any) => {
          if (!oldData || oldData.id !== postId) return oldData;
          return {
            ...oldData,
            userVote,
            upvoteCount,
            downvoteCount,
            score,
            liked: userVote === 'upvote',
            likeCount: upvoteCount,
          };
        }
      );

      // 통합 피드 최종 업데이트
      queryClient.setQueriesData(
        { queryKey: feedQueryKeys.all },
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              items: page.items.map(item =>
                item.id === postId
                  ? {
                      ...item,
                      userVote,
                      upvoteCount,
                      downvoteCount,
                      score,
                      liked: userVote === 'upvote' ? true : undefined,
                      likeCount: upvoteCount,
                    }
                  : item
              ),
            })),
          };
        }
      );
    },
  });
}

export default useVote;
