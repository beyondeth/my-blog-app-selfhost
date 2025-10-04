import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { Post } from '@/types';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRef, useCallback } from 'react';

// Query 키 팩토리 패턴
export const postQueryKeys = {
  all: ['posts'] as const,
  lists: () => [...postQueryKeys.all, 'list'] as const,
  list: (filters: { search?: string; category?: string; blogSlug?: string }) => 
    [...postQueryKeys.lists(), filters] as const,
  details: () => [...postQueryKeys.all, 'detail'] as const,
  detail: (slugOrId: string) => [...postQueryKeys.details(), slugOrId] as const,
};

// 공통 쿼리 옵션
const commonQueryOptions = {
  gcTime: 10 * 60 * 1000, // 10분 (가비지 컬렉션 - 메모리에서 제거되는 시간)
  staleTime: 10 * 60 * 1000, // 10분 - Optimistic Update로 즉시 반영, 불필요한 refetch 방지
  refetchOnWindowFocus: true, // 탭 전환시 자동 갱신 (사용자가 탭으로 돌아올 때 최신 데이터 보장)
  refetchOnMount: false, // 마운트시 refetch 비활성화 (성능 최적화)
  retry: 1,
};

// 무한 스크롤 포스트 목록 훅
export function useInfinitePosts(options: { 
  search?: string; 
  category?: string;
  blogSlug?: string;
  enabled?: boolean;
} = {}) {
  const { search, category, blogSlug, enabled = true } = options;
  
  return useInfiniteQuery({
    queryKey: postQueryKeys.list({ search, category, blogSlug }),
    queryFn: ({ pageParam = 1 }) => postsAPI.getPosts({ 
      page: pageParam, 
      limit: 20,  // 한 번에 20개씩 로드하여 스크롤 빈도 감소
      search: search || undefined,
      category: category || undefined,
      blogSlug: blogSlug || undefined,
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
    refetchOnMount: false, // 프로덕션 설정으로 복구
  });
}

// 단일 포스트 조회 훅 (상세)
export function usePost(slugOrId: string) {
  return useQuery({
    queryKey: postQueryKeys.detail(slugOrId),
    queryFn: () => postsAPI.getPostBySlug(slugOrId),
    enabled: !!slugOrId,
    ...commonQueryOptions,
    refetchOnMount: false, // 프로덕션 설정으로 복구 (SSR/Prefetch 활용)
  });
}

// 포스트 생성 뮤테이션 훅
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsAPI.createPost,
    onSuccess: (newPost) => {
      // 1. 첫 페이지만 무효화 (새 포스트는 항상 첫 페이지에만 나타남)
      // 검색이나 필터가 없는 기본 목록만 무효화하여 성능 최적화
      queryClient.invalidateQueries({
        queryKey: postQueryKeys.list({}), // 필터 없는 기본 목록
        exact: false,
        refetchType: 'active' // 현재 활성화된 쿼리만 refetch
      });

      // 1-1. 작성자 블로그 캐시 무효화 및 즉시 업데이트 (작성자가 "내 블로그"에서 즉시 확인 가능)
      if (newPost.blog?.slug) {
        // 캐시 완전 제거 (staleTime 무시)
        queryClient.removeQueries({
          queryKey: postQueryKeys.list({ blogSlug: newPost.blog.slug }),
          exact: false
        });

        // 즉시 무효화
        queryClient.invalidateQueries({
          queryKey: postQueryKeys.list({ blogSlug: newPost.blog.slug }),
          exact: false
        });
      }

      // 2. 무한 스크롤 쿼리의 첫 번째 페이지에 새 게시글 추가 (낙관적 업데이트)
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;
          
          // 첫 번째 페이지에 새 게시글을 맨 앞에 추가
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
      
      // 3. 생성된 게시글의 개별 캐시는 설정하지 않음
      // 생성 직후 상세 페이지로 이동할 때 서버에서 완전한 데이터를 다시 가져오도록 함
      // (create endpoint 응답과 findOne/findBySlug 응답 구조가 다를 수 있음)
    },
    retry: 1,
  });
}

// 포스트 수정 뮤테이션 훅
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      postsAPI.updatePost(id, data),
    onSuccess: (updatedPost) => {
      // 1. 개별 포스트 캐시 직접 업데이트
      queryClient.setQueryData(postQueryKeys.detail(updatedPost.id), updatedPost);
      if (updatedPost.slug) {
        queryClient.setQueryData(postQueryKeys.detail(updatedPost.slug), updatedPost);
      }

      // 2. Active 목록 캐시에서 해당 포스트 업데이트 (Optimistic Update - 서버 refetch 없음)
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

      // 3. Inactive 쿼리들을 stale로 표시 (사용자가 돌아갈 때 자동 refetch)
      // refetchType: 'none' → 즉시 refetch 안함, stale만 표시
      queryClient.invalidateQueries({
        queryKey: postQueryKeys.lists(),
        refetchType: 'none',
      });
    },
    retry: 1,
  });
}

// 포스트 삭제 뮤테이션 훅
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: postsAPI.deletePost,
    onMutate: async (deletedId) => {
      // 삭제 전에 포스트 정보 백업 (blog 정보 필요)
      const previousPost = queryClient.getQueryData<Post>(
        postQueryKeys.detail(deletedId)
      );

      console.log('🗑️ [Post Delete - onMutate]', {
        postId: deletedId,
        hasPreviousPost: !!previousPost,
        blogSlug: previousPost?.blog?.slug
      });

      return { previousPost };
    },
    onSuccess: (_, deletedId, context) => {
      console.log('✅ [Post Deleted]', {
        postId: deletedId,
        blogSlug: context?.previousPost?.blog?.slug
      });

      // 1. 삭제된 포스트 상세 캐시 제거
      queryClient.removeQueries({ queryKey: postQueryKeys.detail(deletedId) });

      // 2. 무한 스크롤 목록에서 즉시 제거 (낙관적 업데이트)
      queryClient.setQueriesData(
        { queryKey: postQueryKeys.lists() },
        (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;

          // 모든 페이지에서 삭제된 포스트 필터링
          const newPages = oldData.pages.map((page: any) => ({
            ...page,
            posts: page.posts.filter((post: any) => post.id !== deletedId),
            total: page.posts.some((post: any) => post.id === deletedId)
              ? page.total - 1
              : page.total
          }));

          return {
            ...oldData,
            pages: newPages,
          };
        }
      );

      // 3. 홈 피드 캐시 무효화
      queryClient.invalidateQueries({
        queryKey: postQueryKeys.list({}),
        exact: false,
        refetchType: 'active'
      });

      // 4. 블로그별 캐시 무효화 (생성과 동일한 로직)
      // 작성자가 "내 블로그"에서 즉시 삭제 확인 가능
      if (context?.previousPost?.blog?.slug) {
        console.log('✅ [Invalidating Blog Cache on Delete]', context.previousPost.blog.slug);

        // 캐시 완전 제거 (staleTime 무시)
        queryClient.removeQueries({
          queryKey: postQueryKeys.list({ blogSlug: context.previousPost.blog.slug }),
          exact: false
        });

        // 즉시 무효화
        queryClient.invalidateQueries({
          queryKey: postQueryKeys.list({ blogSlug: context.previousPost.blog.slug }),
          exact: false
        });
      } else {
        console.warn('⚠️ [No Blog Info for Delete]', 'previousPost.blog is missing!');
      }
    },
    retry: 1,
  });
}

// 포스트 좋아요 토글 뮤테이션 훅 (권장: 로그인 체크/낙관적 업데이트/롤백 일원화)
export function useTogglePostLike(slug: string, onRequireLogin?: () => void) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (postId: string) => {
      if (!user) {
        if (onRequireLogin) onRequireLogin();
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return postsAPI.toggleLike(postId);
    },
    onMutate: async () => {
      // 진행 중인 리페치 취소
      await queryClient.cancelQueries({ queryKey: postQueryKeys.detail(slug) });
      
      // 이전 데이터 백업
      const previousPost = queryClient.getQueryData<Post>(postQueryKeys.detail(slug));
      
      // 낙관적 업데이트: liked/likeCount
      if (previousPost) {
        const liked = !previousPost.liked;
        let likeCount = previousPost.likeCount + (liked ? 1 : -1);
        if (likeCount < 0) likeCount = 0;
        
        queryClient.setQueryData(postQueryKeys.detail(slug), {
          ...previousPost,
          liked,
          likeCount
        });
      }
      
      return { previousPost };
    },
    onError: (err, variables, context) => {
      // 롤백: 이전 데이터로 복구
      if (context?.previousPost) {
        queryClient.setQueryData(postQueryKeys.detail(slug), context.previousPost);
      }
    },
    onSuccess: (response, variables, context) => {
      // 서버 응답 성공: 실제 데이터로 교체하지만 invalidation은 하지 않음
      queryClient.setQueryData(postQueryKeys.detail(slug), (old: Post | undefined) => {
        if (!old) return old;
        return { ...old, liked: response.liked };
      });
    },
    retry: 1,
  });
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