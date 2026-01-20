import React from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { Post } from '@/types';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRef, useCallback } from 'react';
import { mixpanel } from '@/lib/mixpanel';
import { useRouter } from 'next/navigation'; // useRouter 훅 추가
import { getPostUrl } from '@/lib/utils/blogUrl';
import type { GetPostsCursorParams } from '@/lib/api/endpoints/posts';
import { feedQueryKeys } from '@/hooks/feed/useUnifiedFeed';
import type { UnifiedFeedResponse } from '@/services/api/feed.service';

// Query 키 팩토리 패턴 (표준화)
export const postQueryKeys = {
  all: ['posts'] as const,
  lists: () => [...postQueryKeys.all, 'list'] as const,
  list: (filters: {
    search?: string;
    category?: string;
    blogSlug?: string;
    blogId?: string;
    page?: number;
    limit?: number;
    sort?: string;
    cursor?: boolean;
  }) => {
    // 정렬된 키 생성으로 캐시 일관성 보장
    const sortedFilters = Object.entries(filters).reduce((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    return [...postQueryKeys.lists(), sortedFilters] as const;
  },
  details: () => [...postQueryKeys.all, 'detail'] as const,
  detail: (slugOrId: string) => [...postQueryKeys.details(), slugOrId] as const,
  // 캐시 무효화를 위한 헬퍼 키
  userPosts: (userId: string) => [...postQueryKeys.all, 'user', userId] as const,
  blogPosts: (blogIdentifier: string) => [...postQueryKeys.all, 'blog', blogIdentifier] as const,
};

// 공통 쿼리 옵션
const commonQueryOptions = {
  gcTime: 5 * 60 * 1000,
  staleTime: 5 * 60 * 1000, // 5분간 캐시 유지 (탭 전환 시 즉시 렌더링)
  refetchOnWindowFocus: false, // 탭 전환시 자동 갱신 비활성화
  refetchOnMount: false, // 컴포넌트 마운트 시 불필요한 재요청 방지
  retry: 1,
};

// 무한 스크롤 포스트 목록 훅
export function useInfinitePosts(options: {
  search?: string;
  category?: string;
  blogSlug?: string;
  blogId?: string;
  enabled?: boolean;
} = {}) {
  const { search, category, blogSlug, blogId, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: postQueryKeys.list({ search, category, blogSlug, blogId }),
    queryFn: ({ pageParam = 1 }) => postsAPI.getPosts({ 
      page: pageParam, 
      limit: 20,  // 한 번에 20개씩 로드하여 스크롤 빈도 감소
      search: search || undefined,
      category: category || undefined,
      blogSlug: blogSlug || undefined,
      blogId: blogId || undefined,
    }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || !allPages) return undefined;
      const currentPage = allPages.length;
      const totalPages = Math.ceil(lastPage.total / 20);  // limit과 동일하게 변경
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
    ...commonQueryOptions,
    // refetchOnMount는 commonQueryOptions에서 설정 (중복 제거)
  });
}

// 단일 포스트 조회 훅 (상세)
interface UsePostOptions {
  initialData?: any; // Post 타입으로 나중에 변경 가능
  enabled?: boolean;
  refetchOnMount?: boolean | 'always';
}

export function usePost(
  slugOrId: string,
  options?: UsePostOptions,
) {
  const refetchOnMountOption = options?.refetchOnMount ?? (!options?.initialData ? 'always' : false);

  return useQuery({
    queryKey: postQueryKeys.detail(slugOrId),
    queryFn: () => postsAPI.getPostBySlug(slugOrId),
    enabled: options?.enabled ?? !!slugOrId,
    ...commonQueryOptions,
    initialData: options?.initialData,
    refetchOnMount: refetchOnMountOption,
    // 항상 즉시 stale 처리하여 캐시 무효화가 바로 반영되도록 함
    staleTime: 0,
  });
}

// 포스트 생성 뮤테이션 훅
export function useCreatePost() {
  const queryClient = useQueryClient();
  const router = useRouter(); // useRouter 훅 추가

  const mutation = useMutation({
    mutationFn: postsAPI.createPost,
    retry: 1,
  });

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess && mutation.data) {
      const newPost = mutation.data;

      // Mixpanel: 포스트 생성 이벤트 추적
      mixpanel.track('Post Created', {
        categoryId: newPost.category,
        tags: newPost.tags,
        wordCount: newPost.content ? newPost.content.length : 0,
      });

      // 1. 모든 캐시 즉시 무효화하고 강제 refetch (즉시 반영 보장)
      queryClient.invalidateQueries({
        queryKey: postQueryKeys.lists(),
        refetchType: 'active'
      });

      // 1-1. 작성자 블로그 캐시 즉시 무효화
      if (newPost.blog?.slug) {
        queryClient.invalidateQueries({
          queryKey: postQueryKeys.list({ blogSlug: newPost.blog.slug }),
          refetchType: 'active'
        });
      }

      // 1-2. 즉시 백그라운드에서 refetch 강제 실행
      setTimeout(() => {
        queryClient.refetchQueries({
          queryKey: postQueryKeys.lists(),
          exact: false
        });
      }, 100); // 100ms 후 추가 refetch (DB 트랜잭 보장)

      // 2. 무한 스크롤 쿼리의 첫 번째 페이지에 새 게시글 추가 (낙관적 업데이트)
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;

          const newPages = [...oldData.pages];
          if (newPages[0]) {
            newPages[0] = {
              ...newPages[0],
              posts: [newPost, ...newPages[0].posts],
              total: newPages[0].total + 1,
            };
          }

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );

      // 3. 생성된 포스트의 상세 페이지로 이동 (단, 초안이 아닌 경우에만)
      if (newPost.blog && newPost.status !== 'draft') {
        const postUrl = getPostUrl(newPost.blog, { slug: newPost.slug, id: newPost.id });
        router.push(postUrl);
      }
    }
  }, [mutation.isSuccess, mutation.data, queryClient, router]);

  return mutation;
}

// 포스트 수정 뮤테이션 훅
export function useUpdatePost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      postsAPI.updatePost(id, data),
    retry: 1,
  });

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess && mutation.data) {
      const updatedPost = mutation.data;

      // 1. 개별 포스트 캐시 직접 업데이트
      queryClient.setQueryData(postQueryKeys.detail(updatedPost.id), updatedPost);
      if (updatedPost.slug) {
        queryClient.setQueryData(postQueryKeys.detail(updatedPost.slug), updatedPost);
      }

      // 2. 모든 상세 페이지 쿼리 즉시 무효화 (강제로 fresh 데이터 가져오도록)
      queryClient.invalidateQueries({ queryKey: postQueryKeys.details() });

      // 3. Active 목록 캐시에서 해당 포스트 업데이트 (Optimistic Update - 서버 refetch 없음)
      // 사용자 브라우저의 메모리에 있는 포스트 목록만 업데이트 (보통 20~40개)
      // 다른 사용자나 서버 DB에는 영향 없음
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData?.pages) return oldData;

          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              posts: page.posts.map((post: any) =>
                post.id === updatedPost.id
                  ? { ...post, ...updatedPost } // 수정된 포스트 데이터로 교체
                  : post
              ),
            })),
          };
        }
      );

      // 4. Active 쿼리들 즉시 refetch (최신 데이터 보장)
      queryClient.refetchQueries({
        queryKey: postQueryKeys.lists(),
        type: 'active',
      });

      // 5. Inactive 쿼리들은 stale로 표시 (사용자가 돌아갈 때 자동 refetch)
      queryClient.invalidateQueries({
        queryKey: postQueryKeys.lists(),
        refetchType: 'none',
      });

      // 6. 인기포스트 캐시 무효화 (포스트 수정 시 인기포스트도 업데이트 필요)
      queryClient.invalidateQueries({
        queryKey: ['popular-posts'],
        refetchType: 'none', // stale만 마킹, 사용자가 다시 볼 때 자동 refetch
      });

      // 7. 블로그 관련 캐시도 무효화
      if (updatedPost.blog?.slug) {
        queryClient.invalidateQueries({ queryKey: ['blog', updatedPost.blog.slug] });
        queryClient.invalidateQueries({
          queryKey: postQueryKeys.list({ blogSlug: updatedPost.blog.slug })
        });
      }
    }
  }, [mutation.isSuccess, mutation.data, queryClient]);

  return mutation;
}

// 포스트 삭제 뮤테이션 훅
export function useDeletePost() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    // mutationFn: 하위 호환성을 위해 string | { postId, blogSlug? } 모두 지원
    mutationFn: (variables: string | { postId: string; blogSlug?: string }) => {
      const postId = typeof variables === 'string' ? variables : variables.postId;
      return postsAPI.deletePost(postId);
    },
    onMutate: async (variables) => {
      // 파라미터에서 postId와 blogSlug 추출
      const deletedId = typeof variables === 'string' ? variables : variables.postId;
      let blogSlug = typeof variables === 'string' ? undefined : variables.blogSlug;

      // 1. 진행 중인 리페치 취소 (Race condition 방지)
      await queryClient.cancelQueries({ queryKey: postQueryKeys.lists() });
      await queryClient.cancelQueries({ queryKey: feedQueryKeys.all });

      // 2. 삭제 전에 포스트 정보 백업 (롤백용)
      // 2-1. detail 캐시에서 찾기 (UUID로)
      let previousPost = queryClient.getQueryData<Post>(
        postQueryKeys.detail(deletedId)
      );

      // 2-2. blogSlug가 파라미터로 전달되지 않았고, detail 캐시에 있으면 사용
      if (!blogSlug && previousPost?.blog?.slug) {
        blogSlug = previousPost.blog.slug;
      }

      // 2-3. 여전히 blogSlug가 없으면 무한 스크롤 목록 캐시에서 찾기
      if (!blogSlug) {
        const allPosts = queryClient.getQueriesData<any>({
          queryKey: postQueryKeys.lists()
        });

        // 무한 스크롤 캐시에서 삭제할 포스트 찾기
        for (const [_, data] of allPosts) {
          if (data?.pages) {
            for (const page of data.pages) {
              const post = page?.posts?.find((p: any) => p.id === deletedId);
              if (post?.blog?.slug) {
                blogSlug = post.blog.slug;
                previousPost = post;
                break;
              }
            }
          }
          if (blogSlug) break;
        }
      }

      // 3. 이전 데이터 전체 백업 (롤백용)
      const previousLists = queryClient.getQueriesData({ queryKey: postQueryKeys.lists() });
      const previousFeed = queryClient.getQueriesData({ queryKey: feedQueryKeys.all });

      // 4. 🚀 낙관적 업데이트: 모든 list 캐시에서 즉시 제거 (홈, 블로그, 검색 등 모든 목록)
      // useUpdatePost, useTogglePostLike와 동일한 패턴 사용
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;

          const newPages = oldData.pages.map((page: any) => {
            if (!page || !page.posts) return page;

            const hasDeletedPost = page.posts.some((post: any) => post.id === deletedId);

            return {
              ...page,
              posts: page.posts.filter((post: any) => post.id !== deletedId),
              total: hasDeletedPost ? page.total - 1 : page.total
            };
          });

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );

      // 5. 상세 캐시도 즉시 제거
      queryClient.removeQueries({ queryKey: postQueryKeys.detail(deletedId) });

      // 6. 통합 피드에서도 제거
      queryClient.setQueriesData(
        { queryKey: feedQueryKeys.all },
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;

          const updatedPages = oldData.pages.map(page => ({
            ...page,
            items: page.items.filter(item => item.id !== deletedId),
          }));

          return { ...oldData, pages: updatedPages };
        }
      );

      return { previousPost, blogSlug, previousLists, previousFeed };
    },
    retry: 0,  // 삭제는 재시도 안 함 (이미 삭제된 포스트 재요청 방지)
  });

  // 에러 처리
  React.useEffect(() => {
    if (mutation.isError && mutation.error && mutation.variables) {
      const variables = mutation.variables;
      const context = mutation.context as { previousPost?: Post; blogSlug?: string; previousLists?: Array<[any, any]>; previousFeed?: Array<[any, any]> };

      // 롤백: 이전 데이터로 복구
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

      // 상세 캐시 복구
      const deletedId = typeof variables === 'string' ? variables : variables.postId;
      if (context?.previousPost) {
        queryClient.setQueryData(
          postQueryKeys.detail(deletedId),
          context.previousPost
        );
      }
    }
  }, [mutation.isError, mutation.error, mutation.variables, mutation.context, queryClient]);

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess) {
      // 서버 동기화: stale 마킹하여 다음 접근 시 최신 데이터 가져오기
      // refetchType: 'none' - 즉시 refetch 안함 (낙관적 업데이트 유지)
      // 모든 list 캐시를 stale로 마킹 (홈, 블로그, 검색 등)
      queryClient.invalidateQueries({
        queryKey: postQueryKeys.lists(),
        refetchType: 'none'
      });

      queryClient.invalidateQueries({
        queryKey: feedQueryKeys.all,
        refetchType: 'none'
      });

      // ⬇️ 추가: Editor's Pick 캐시 무효화 (삭제된 포스트가 목록에서 즉시 제거)
      queryClient.invalidateQueries({ queryKey: ['editorPicks'] });
      queryClient.invalidateQueries({ queryKey: ['adminEditorPicks'] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'home'] });

      const context = mutation.context as {
        blogSlug?: string;
      } | null;

      if (context?.blogSlug) {
        const normalizedBlogSlug = context.blogSlug.replace('@', '');
        queryClient.invalidateQueries({
          queryKey: ['blog-categories', normalizedBlogSlug],
        });
      }
    }
  }, [mutation.isSuccess, queryClient]);

  return mutation;
}

// 포스트 좋아요 토글 뮤테이션 훅 (Redis Queue 시스템 - postId 파라미터로 받기)
export function useTogglePostLike(onRequireLogin?: () => void) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const mutation = useMutation({
    mutationFn: (postId: string) => {
      if (!user) {
        if (onRequireLogin) onRequireLogin();
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }

      // Redis 큐로 전송 (디바운싱 제거 - 백엔드에서 처리)
      return postsAPI.toggleLike(postId);
    },
    onMutate: async (postId: string) => {
      // 1. 진행 중인 리페치 취소 (모든 관련 쿼리)
      await queryClient.cancelQueries({ queryKey: postQueryKeys.all });
      await queryClient.cancelQueries({ queryKey: feedQueryKeys.all });

      // 2. 이전 데이터 백업 (롤백용)
      const previousLists = queryClient.getQueriesData({ queryKey: postQueryKeys.lists() });
      const previousDetails = queryClient.getQueriesData({ queryKey: postQueryKeys.details() });
      const previousFeed = queryClient.getQueriesData({ queryKey: feedQueryKeys.all });

      // 3. 낙관적 업데이트: 모든 목록 캐시 업데이트 (홈, 내블로그, 검색 등)
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
                posts: page.posts.map((post: any) => {
                  if (post.id !== postId) return post;

                  // 좋아요 토글
                  const liked = !post.liked;
                  let likeCount = post.likeCount + (liked ? 1 : -1);
                  if (likeCount < 0) likeCount = 0;

                  return { ...post, liked, likeCount };
                })
              };
            })
          };
        }
      );

      // 4. 낙관적 업데이트: 모든 상세 캐시 업데이트
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.details() },
        (oldData: any) => {
          if (!oldData || oldData.id !== postId) return oldData;

          // 좋아요 토글
          const liked = !oldData.liked;
          let likeCount = oldData.likeCount + (liked ? 1 : -1);
          if (likeCount < 0) likeCount = 0;

          return { ...oldData, liked, likeCount };
        }
      );

      // 5. 통합 피드 캐시 업데이트
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

                const liked = !(item.userVote === 'upvote');
                let likeCount = item.upvoteCount ?? item.likeCount ?? 0;
                likeCount += liked ? 1 : -1;
                if (likeCount < 0) likeCount = 0;

                return {
                  ...item,
                  liked: liked || undefined,
                  likeCount,
                  upvoteCount: likeCount,
                  userVote: liked ? 'upvote' : null,
                  score: likeCount - (item.downvoteCount ?? 0),
                };
              }),
            })),
          };
        }
      );

      return { previousLists, previousDetails, previousFeed };
    },
    retry: 1,
  });

  // 에러 처리
  React.useEffect(() => {
    if (mutation.isError && mutation.error && mutation.variables) {
      const context = mutation.context as { previousLists?: Array<[any, any]>; previousDetails?: Array<[any, any]>; previousFeed?: Array<[any, any]> };

      // 롤백: 이전 데이터로 복구
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousDetails) {
        context.previousDetails.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      if (context?.previousFeed) {
        context.previousFeed.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    }
  }, [mutation.isError, mutation.error, mutation.variables, mutation.context, queryClient]);

  // 성공 처리
  React.useEffect(() => {
    if (mutation.isSuccess && mutation.data && mutation.variables) {
      const postId = mutation.variables;
      const response = mutation.data;

      // Mixpanel: 좋아요 이벤트 추적
      mixpanel.track('Post Liked', { postId });

      // 큐 시스템 사용 시, 낙관적 업데이트 상태 유지 (깜빡임 방지)
      if (response.queued) {
        return; // 서버 응답 무시, onMutate의 낙관적 업데이트 상태 그대로 유지
      }

      // queued가 아닌 경우에만 서버 응답으로 최종 확정 (모든 캐시 업데이트)
      const { liked, likeCount } = response;
      const normalizedLikeCount = typeof likeCount === 'number' ? likeCount : 0;

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
                posts: page.posts.map((post: any) =>
                  post.id === postId ? { ...post, liked, likeCount: normalizedLikeCount } : post
                )
              };
            })
          };
        }
      );

      // 상세 캐시 최종 업데이트
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.details() },
        (oldData: any) => {
          if (!oldData || oldData.id !== postId) return oldData;
          return { ...oldData, liked, likeCount: normalizedLikeCount };
        }
      );
      // 통합 피드 캐시 최종 업데이트
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
                      liked: liked || undefined,
                      likeCount: normalizedLikeCount,
                      upvoteCount: normalizedLikeCount,
                      userVote: liked ? 'upvote' : null,
                      score: normalizedLikeCount - (item.downvoteCount ?? 0),
                    }
                  : item
              ),
            })),
          };
        }
      );
    }
  }, [mutation.isSuccess, mutation.data, mutation.variables, queryClient]);

  return mutation;
}

// 포스트 프리페치 유틸리티
export function usePrefetchPost() {
  const queryClient = useQueryClient();
  return (slugOrId: string) => {
    queryClient.prefetchQuery({
      queryKey: postQueryKeys.detail(slugOrId),
      queryFn: () => postsAPI.getPostBySlug(slugOrId),
      ...commonQueryOptions,
    });
  };
}

// 캐시를 완전히 제거하고 새로 fetch하는 유틸리티 함수
// 스키마 변경이나 캐시 문제 발생시 사용
// export function useClearPostCache() {
//   const queryClient = useQueryClient();

//   return () => {
//     // 모든 포스트 관련 캐시 제거
//     queryClient.removeQueries({ queryKey: postQueryKeys.all });
//     // 제거 후 즉시 무효화하여 새로운 데이터 fetch
//     queryClient.invalidateQueries({ queryKey: postQueryKeys.all });
//     console.log('✅ 포스트 캐시가 완전히 제거되고 새로운 데이터를 가져옵니다.');
//   };
// }

// 여러 포스트의 좋아요 상태를 10분간 모아뒀다가 한 번에 서버로 전송하는 배치 훅
// (debounce: 10분, 여러 포스트 동시 지원)
export function useBatchLikeManager() {
  // { [postId]: liked }
  const pendingLikesRef = useRef<Record<string, boolean>>({});
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 서버로 배치 전송 (여러 포스트 동시)
  const sendBatch = useCallback(() => {
    const batch = pendingLikesRef.current;
    if (Object.keys(batch).length === 0) return;
    postsAPI.batchUpdateLikes(batch)
      .then(() => { /* 성공 시 처리 (선택) */ })
      .catch(() => { /* 실패 시 처리 (선택) */ });
    pendingLikesRef.current = {};
  }, []);

  // 좋아요 상태 변경 시 호출
  const updateLike = useCallback((postId: string, liked: boolean) => {
    pendingLikesRef.current[postId] = liked;
    // 기존 타이머 초기화
    if (timerRef.current) clearTimeout(timerRef.current);
    // 10분(600,000ms) 후에 배치 전송
    timerRef.current = setTimeout(() => {
      sendBatch();
    }, 600000);
  }, [sendBatch]);

  // 강제 즉시 전송 (예: 페이지 이탈 등)
  const flush = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    sendBatch();
  }, [sendBatch]);

  return { updateLike, flush };
}

/**
 * 사용자의 카테고리 목록 조회 훅 (자동완성용)
 *
 * @description
 * 로그인한 사용자가 작성한 포스트의 카테고리 목록을 가져옵니다.
 * 글쓰기/수정 페이지의 자동완성 드롭다운에서 사용됩니다.
 *
 * @returns 카테고리 목록 (사용 빈도순)
 */
export function useUserCategories() {
  return useQuery({
    queryKey: ['user-categories'],
    queryFn: async (): Promise<string[]> => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/categories`,
        {
          credentials: 'include',
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch user categories');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5분간 캐시
    gcTime: 10 * 60 * 1000, // 10분간 가비지 컬렉션 방지
  });
}

/**
 * 캐시 관리 유틸리티 함수
 * - 메모리 누수 방지를 위한 캐시 클린업
 * - 컴포넌트 언마운트 시 호출
 */
export const usePostCacheCleanup = () => {
  const queryClient = useQueryClient();

  return useCallback(() => {
    // 1. 오래된 포스트 상세 캐시 정리 (10분 이상)
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    queries.forEach(query => {
      if (query.queryKey[0] === 'posts' &&
          query.queryKey[1] === 'detail' &&
          query.state.dataUpdatedAt &&
          Date.now() - query.state.dataUpdatedAt > 10 * 60 * 1000) {
        queryClient.removeQueries({ queryKey: query.queryKey });
      }
    });

    // 2. 비활성 포스트 목록 캐시 정리
    queryClient.removeQueries({
      queryKey: postQueryKeys.lists(),
      predicate: (query) => {
        return !!(query.state.dataUpdatedAt &&
               Date.now() - query.state.dataUpdatedAt > 30 * 60 * 1000); // 30분 이상
      }
    });

    // 3. 메모리 사용량 최적화
    if (queries.length > 100) {
      // 가장 오래된 쿼리들 정리
      const sortedQueries = queries
        .filter(q => q.queryKey[0] === 'posts')
        .sort((a, b) => (a.state.dataUpdatedAt || 0) - (b.state.dataUpdatedAt || 0));

      const toRemove = sortedQueries.slice(0, 20);
      toRemove.forEach(query => {
        queryClient.removeQueries({ queryKey: query.queryKey });
      });
    }
  }, [queryClient]);
};

// 커서 기반 무한 스크롤 포스트 목록 훅
export function useInfiniteCursorPosts(options: {
  search?: string;
  category?: string;
  blogSlug?: string;
  blogId?: string;
  sort?: 'recent' | 'popular' | 'trending';
  limit?: number;
  enabled?: boolean;
} = {}) {
  const { search, category, blogSlug, blogId, sort = 'recent', limit = 20, enabled = true } = options;

  return useInfiniteQuery({
    queryKey: postQueryKeys.list({ search, category, blogSlug, blogId, sort, cursor: true }),
    queryFn: ({ pageParam }) => postsAPI.getPostsCursor({
      cursor: pageParam || undefined, // pageParam이 string | undefined 타입이므로 처리
      limit,
      sort,
      search,
      category,
      blogSlug,
      blogId,
    }),
    getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
    initialPageParam: undefined as string | undefined, // 명시적인 타입 지정
    enabled,
    ...commonQueryOptions,
    refetchOnMount: false, // 처음 마운트 시 refetch 방지 (새로고침 방지)
  });
};

/**
 * 특정 블로그의 포스트 캐시 무효화
 * - 블로그 alias 변경 시 사용
 */
export const useInvalidateBlogPosts = () => {
  const queryClient = useQueryClient();

  return useCallback((blogIdentifier: string) => {
    // 블로그 관련 모든 캐시 무효화
    queryClient.invalidateQueries({
      queryKey: postQueryKeys.blogPosts(blogIdentifier)
    });

    // 목록 쿼리에서 해당 블로그 포스트들도 무효화
    queryClient.invalidateQueries({
      queryKey: postQueryKeys.lists(),
      predicate: (query) => {
        const filters = query.queryKey[2] as any;
        return filters?.blogSlug === blogIdentifier ||
               filters?.blogId === blogIdentifier;
      }
    });
  }, [queryClient]);
}; 

/**
 * 사용자의 초안 목록 조회 훅
 * 
 * @description
 * 로그인한 사용자의 임시저장된 초안 목록을 가져옵니다.
 * /drafts 페이지에서 사용됩니다.
 * 
 * @returns 초안 포스트 목록 (최근 수정순)
 */
export function useDrafts() {
  return useQuery({
    queryKey: ['drafts'],
    queryFn: async (): Promise<Post[]> => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/drafts`,
        {
          credentials: 'include',
        }
      );
      if (!response.ok) {
        throw new Error('Failed to fetch drafts');
      }
      return response.json();
    },
    staleTime: 1 * 60 * 1000, // 1분간 캐시
    gcTime: 5 * 60 * 1000, // 5분간 가비지 컬렉션 방지
  });
}
