'use client';

import { useQuery, useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type {
  CommunityPost,
  GetCommunityPostsQuery,
  CreateCommunityPostDto,
  UpdateCommunityPostDto,
  CommunityPostListResponse,
  LikeToggleResponse,
  VoteResponse,
} from '@/types/community';
import type { VoteType } from '@/types';
import { feedQueryKeys } from '@/hooks/feed/useUnifiedFeed';
import type { UnifiedFeedResponse } from '@/services/api/feed.service';

/**
 * 커뮤니티 게시물 관련 Query Key 팩토리
 */
export const communityPostQueryKeys = {
  all: ['community-posts'] as const,
  lists: () => [...communityPostQueryKeys.all, 'list'] as const,
  list: (communitySlug: string, filters: Omit<GetCommunityPostsQuery, 'cursor'>) =>
    [...communityPostQueryKeys.lists(), communitySlug, filters] as const,
  details: () => [...communityPostQueryKeys.all, 'detail'] as const,
  detail: (communitySlug: string, postSlug: string) =>
    [...communityPostQueryKeys.details(), communitySlug, postSlug] as const,
  comments: (communitySlug: string, postSlug: string) =>
    [...communityPostQueryKeys.detail(communitySlug, postSlug), 'comments'] as const,
};

/**
 * 커뮤니티 게시물 목록 조회 훅 (무한 스크롤)
 */
export function useCommunityPosts(
  communitySlug: string,
  options: Omit<GetCommunityPostsQuery, 'cursor'> = {}
) {
  const { limit = 20, search, sortBy = 'newest', flairId, authorId, pinnedOnly } = options;

  return useInfiniteQuery<CommunityPostListResponse>({
    queryKey: communityPostQueryKeys.list(communitySlug, { limit, search, sortBy, flairId, authorId, pinnedOnly }),
    queryFn: ({ pageParam }) =>
      communityService.getPosts(communitySlug, {
        cursor: pageParam as string | undefined,
        limit,
        search,
        sortBy,
        flairId,
        authorId,
        pinnedOnly,
      }),
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasNext) return undefined;
      return lastPage.nextCursor ?? undefined;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!communitySlug,
    staleTime: 3 * 60 * 1000, // 3분간 캐시 유지 (탭 전환 시 즉시 렌더링)
  });
}

/**
 * 단일 커뮤니티 게시물 조회 훅
 */
export function useCommunityPost(
  communitySlug: string,
  postSlug: string,
  options?: { enabled?: boolean; initialData?: CommunityPost }
) {
  return useQuery<CommunityPost>({
    queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
    queryFn: () => communityService.getPost(communitySlug, postSlug),
    enabled: options?.enabled !== false && !!communitySlug && !!postSlug,
    initialData: options?.initialData,
    staleTime: 3 * 60 * 1000, // 3분간 캐시 유지
  });
}

/**
 * 커뮤니티 게시물 생성 훅
 */
export function useCreateCommunityPost(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation<CommunityPost, Error, CreateCommunityPostDto>({
    mutationFn: (data: CreateCommunityPostDto) =>
      communityService.createPost(communitySlug, data),
    onSuccess: (newPost: CommunityPost) => {
      // 게시물 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
        exact: false,
      });

      // 상세 정보는 서버 렌더링/후속 fetch로 가져오도록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, newPost.slug),
      });

      // 커뮤니티 postCount 업데이트
      queryClient.invalidateQueries({
        queryKey: ['community', communitySlug],
      });
    },
  });
}

/**
 * 커뮤니티 게시물 수정 훅
 */
export function useUpdateCommunityPost(communitySlug: string, postSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCommunityPostDto) =>
      communityService.updatePost(communitySlug, postSlug, data),
    onSuccess: (updatedPost) => {
      // 게시물 상세 캐시 업데이트
      queryClient.setQueryData(
        communityPostQueryKeys.detail(communitySlug, postSlug),
        updatedPost
      );

      // 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
        exact: false,
      });
    },
  });
}

/**
 * 커뮤니티 게시물 삭제 훅
 */
interface DeleteCommunityPostArgs {
  postId: string;
  postSlug: string;
}

export function useDeleteCommunityPost(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId }: DeleteCommunityPostArgs) =>
      communityService.deletePost(communitySlug, postId),
    onSuccess: (_, variables) => {
      const { postSlug, postId } = variables;
      // 캐시에서 제거
      queryClient.removeQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });

      // 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
        exact: false,
      });

      // 커뮤니티 postCount 업데이트
      queryClient.invalidateQueries({
        queryKey: ['community', communitySlug],
      });

      // 통합 피드에서도 제거
      queryClient.setQueriesData(
        { queryKey: feedQueryKeys.all },
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map(page => ({
              ...page,
              items: page.items.filter((item) => {
                if (item.sourceType !== 'community') return true;
                if (item.community?.slug !== communitySlug) return true;
                const matchesSlug = item.slug === postSlug;
                const matchesId = item.id === postId;
                return !(matchesSlug || matchesId);
              }),
            })),
          };
        }
      );
    },
  });
}

/**
 * 커뮤니티 게시물 좋아요 토글 훅
 * @deprecated useCommunityPostVote 사용 권장
 */
export function useCommunityPostLike(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postSlug: string) =>
      communityService.togglePostLike(communitySlug, postSlug),
    onMutate: async (postSlug) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });

      // 이전 상태 저장
      const previousPost = queryClient.getQueryData<CommunityPost>(
        communityPostQueryKeys.detail(communitySlug, postSlug)
      );

      // 낙관적 업데이트
      if (previousPost) {
        const newLiked = !previousPost.userLiked;
        queryClient.setQueryData<CommunityPost>(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          {
            ...previousPost,
            userLiked: newLiked,
            likeCount: previousPost.likeCount + (newLiked ? 1 : -1),
          }
        );
      }

      // 목록 캐시도 낙관적 업데이트
      queryClient.setQueriesData<{ pages: CommunityPostListResponse[] }>(
        { queryKey: communityPostQueryKeys.lists(), exact: false },
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => {
                if (post.slug === postSlug) {
                  const newLiked = !post.userLiked;
                  return {
                    ...post,
                    userLiked: newLiked,
                    likeCount: post.likeCount + (newLiked ? 1 : -1),
                  };
                }
                return post;
              }),
            })),
          };
        }
      );

      return { previousPost };
    },
    onError: (_, postSlug, context) => {
      // 롤백
      if (context?.previousPost) {
        queryClient.setQueryData(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          context.previousPost
        );
      }
      // 목록도 리페치
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
        exact: false,
      });
    },
    onSettled: (_, __, postSlug) => {
      // 최종 상태 동기화
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });
    },
  });
}

/**
 * 투표 낙관적 업데이트 헬퍼
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
    return {
      nextVote: null,
      upvoteCount: newVoteType === 'upvote' ? currentUpvoteCount - 1 : currentUpvoteCount,
      downvoteCount: newVoteType === 'downvote' ? currentDownvoteCount - 1 : currentDownvoteCount,
    };
  }

  // 투표 없음 → 새 투표 추가
  if (currentVote === null) {
    return {
      nextVote: newVoteType,
      upvoteCount: newVoteType === 'upvote' ? currentUpvoteCount + 1 : currentUpvoteCount,
      downvoteCount: newVoteType === 'downvote' ? currentDownvoteCount + 1 : currentDownvoteCount,
    };
  }

  // 다른 투표로 변경
  if (newVoteType === 'upvote') {
    return { nextVote: 'upvote', upvoteCount: currentUpvoteCount + 1, downvoteCount: currentDownvoteCount - 1 };
  }
  return { nextVote: 'downvote', upvoteCount: currentUpvoteCount - 1, downvoteCount: currentDownvoteCount + 1 };
}

/**
 * 커뮤니티 게시물 투표 훅 (Upvote/Downvote)
 *
 * @description
 * - Reddit 스타일 투표 시스템
 * - 같은 투표 클릭: 취소
 * - 다른 투표 클릭: 변경
 */
/**
 * 투표 컨텍스트 타입 (롤백용)
 */
interface VoteContext {
  previousPost?: CommunityPost;
  previousLists?: Array<[any, any]>;
  previousFeed?: Array<[any, any]>;
}

export function useCommunityPostVote(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation<
    VoteResponse,
    Error,
    { postId: string; postSlug: string; voteType: NonNullable<VoteType> },
    VoteContext
  >({
    mutationFn: ({ postId, voteType }) =>
      communityService.votePost(communitySlug, postId, voteType),

    onMutate: async ({ postSlug, postId, voteType }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });
      await queryClient.cancelQueries({ queryKey: feedQueryKeys.all });

      // 이전 상태 저장
      const previousPost = queryClient.getQueryData<CommunityPost>(
        communityPostQueryKeys.detail(communitySlug, postSlug)
      );
      const previousLists = queryClient.getQueriesData<{ pages: CommunityPostListResponse[] }>({
        queryKey: communityPostQueryKeys.lists(),
      });
      const previousFeed = queryClient.getQueriesData({ queryKey: feedQueryKeys.all });

      // 상세 캐시 낙관적 업데이트
      if (previousPost) {
        const { nextVote, upvoteCount, downvoteCount } = calculateNextVoteState(
          previousPost.userVote ?? null,
          voteType,
          previousPost.upvoteCount ?? 0,
          previousPost.downvoteCount ?? 0
        );

        queryClient.setQueryData<CommunityPost>(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          {
            ...previousPost,
            userVote: nextVote,
            upvoteCount,
            downvoteCount,
            score: upvoteCount - downvoteCount,
            // 하위 호환성
            userLiked: nextVote === 'upvote',
            likeCount: upvoteCount,
          }
        );
      }

      // 목록 캐시 낙관적 업데이트
      queryClient.setQueriesData<{ pages: CommunityPostListResponse[] }>(
        { queryKey: communityPostQueryKeys.lists(), exact: false },
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((post) => {
                if (post.slug === postSlug) {
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
                    userLiked: nextVote === 'upvote',
                    likeCount: upvoteCount,
                  };
                }
                return post;
              }),
            })),
          };
        }
      );

      // 통합 피드 낙관적 업데이트
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

      return { previousPost, previousLists, previousFeed };
    },

    onError: (_, { postSlug }, context) => {
      // 롤백
      if (context?.previousPost) {
        queryClient.setQueryData(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          context.previousPost
        );
      }
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousFeed) {
        context.previousFeed.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },

    onSuccess: (response, { postSlug, postId }) => {
      const { userVote, upvoteCount, downvoteCount, score } = response;

      // 상세 캐시 최종 업데이트
      queryClient.setQueryData<CommunityPost>(
        communityPostQueryKeys.detail(communitySlug, postSlug),
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            userVote,
            upvoteCount,
            downvoteCount,
            score,
            userLiked: userVote === 'upvote',
            likeCount: upvoteCount,
          };
        }
      );

      // 목록 캐시 최종 업데이트
      queryClient.setQueriesData<{ pages: CommunityPostListResponse[] }>(
        { queryKey: communityPostQueryKeys.lists(), exact: false },
        (oldData) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.map((post) =>
                post.slug === postSlug
                  ? {
                      ...post,
                      userVote,
                      upvoteCount,
                      downvoteCount,
                      score,
                      userLiked: userVote === 'upvote',
                      likeCount: upvoteCount,
                    }
                  : post
              ),
            })),
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

/**
 * 커뮤니티 게시물 조회수 증가 훅
 */
export function useIncrementPostView(communitySlug: string, postSlug: string) {
  return useMutation({
    mutationFn: () => communityService.incrementPostView(communitySlug, postSlug),
    // 조회수는 낙관적 업데이트 없이 서버만 업데이트
  });
}

// =====================================================
// 모더레이션 훅
// =====================================================

/**
 * 고정/잠금 훅의 컨텍스트 타입
 */
interface ModerationContext {
  previousPost?: CommunityPost;
}

/**
 * 게시물 고정/해제 훅 (MODERATOR+)
 */
export function useTogglePostPin(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation<
    CommunityPost,
    Error,
    { postSlug: string; isPinned: boolean },
    ModerationContext
  >({
    mutationFn: ({ postSlug, isPinned }) =>
      communityService.togglePostPin(communitySlug, postSlug, isPinned),
    onMutate: async ({ postSlug, isPinned }) => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });

      // 이전 상태 저장
      const previousPost = queryClient.getQueryData<CommunityPost>(
        communityPostQueryKeys.detail(communitySlug, postSlug)
      );

      // 낙관적 업데이트
      if (previousPost) {
        queryClient.setQueryData<CommunityPost>(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          { ...previousPost, isPinned }
        );
      }

      return { previousPost };
    },
    onError: (_, { postSlug }, context) => {
      // 롤백
      if (context?.previousPost) {
        queryClient.setQueryData(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          context.previousPost
        );
      }
    },
    onSuccess: (updatedPost, { postSlug }) => {
      // 상세 캐시 업데이트
      queryClient.setQueryData(
        communityPostQueryKeys.detail(communitySlug, postSlug),
        updatedPost
      );
      // 목록 캐시 무효화 (고정 순서 변경 반영)
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
      });
    },
  });
}

/**
 * 게시물 잠금/해제 훅 (MODERATOR+)
 */
export function useTogglePostLock(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation<
    CommunityPost,
    Error,
    { postSlug: string; isLocked: boolean },
    ModerationContext
  >({
    mutationFn: ({ postSlug, isLocked }) =>
      communityService.togglePostLock(communitySlug, postSlug, isLocked),
    onMutate: async ({ postSlug, isLocked }) => {
      await queryClient.cancelQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });

      const previousPost = queryClient.getQueryData<CommunityPost>(
        communityPostQueryKeys.detail(communitySlug, postSlug)
      );

      if (previousPost) {
        queryClient.setQueryData<CommunityPost>(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          { ...previousPost, isLocked }
        );
      }

      return { previousPost };
    },
    onError: (_, { postSlug }, context) => {
      if (context?.previousPost) {
        queryClient.setQueryData(
          communityPostQueryKeys.detail(communitySlug, postSlug),
          context.previousPost
        );
      }
    },
    onSuccess: (updatedPost, { postSlug }) => {
      queryClient.setQueryData(
        communityPostQueryKeys.detail(communitySlug, postSlug),
        updatedPost
      );
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
      });
    },
  });
}

/**
 * 게시물 매니저 삭제 훅 (MODERATOR+)
 * 일반 삭제와 다르게 사유 입력 가능
 */
export function useRemovePost(communitySlug: string) {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { postSlug: string; reason?: string }>({
    mutationFn: ({ postSlug, reason }) =>
      communityService.removePost(communitySlug, postSlug, reason),
    onSuccess: (_, { postSlug }) => {
      // 캐시에서 제거
      queryClient.removeQueries({
        queryKey: communityPostQueryKeys.detail(communitySlug, postSlug),
      });
      // 목록 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: communityPostQueryKeys.lists(),
      });
      // 커뮤니티 postCount 업데이트
      queryClient.invalidateQueries({
        queryKey: ['community', communitySlug],
      });
    },
  });
}
