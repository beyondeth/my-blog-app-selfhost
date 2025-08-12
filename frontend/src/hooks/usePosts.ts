import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';
import { Post } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useRef, useCallback } from 'react';

// Query 키 팩토리 패턴
export const postQueryKeys = {
  all: ['posts'] as const,
  lists: () => [...postQueryKeys.all, 'list'] as const,
  list: (filters: { search?: string; category?: string; blogSlug?: string }) => 
    [...postQueryKeys.lists(), filters] as const,
  details: () => [...postQueryKeys.all, 'detail'] as const,
  detail: (slugOrId: string | number) => [...postQueryKeys.details(), slugOrId] as const,
};

// 공통 쿼리 옵션
const commonQueryOptions = {
  gcTime: 10 * 60 * 1000, // 10분
  staleTime: 5 * 60 * 1000, // 5분
  refetchOnWindowFocus: false,
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
      limit: 10,
      search: search || undefined,
      category: category || undefined,
      blogSlug: blogSlug || undefined,
    }),
    getNextPageParam: (lastPage, allPages) => {
      const currentPage = allPages.length;
      const totalPages = Math.ceil(lastPage.total / 10);
      return currentPage < totalPages ? currentPage + 1 : undefined;
    },
    initialPageParam: 1,
    enabled,
    ...commonQueryOptions,
    refetchOnMount: false,
  });
}

// 단일 포스트 조회 훅 (상세)
export function usePost(slugOrId: string | number) {
  return useQuery({
    queryKey: postQueryKeys.detail(slugOrId),
    queryFn: () => postsAPI.getPostBySlug(slugOrId.toString()),
    enabled: !!slugOrId,
    ...commonQueryOptions,
    refetchOnMount: false, // SSR/Prefetch 활용 시 false가 더 효율적
  });
}

// 포스트 생성 뮤테이션 훅
export function useCreatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postsAPI.createPost,
    onSuccess: (newPost) => {
      // 1. 모든 목록 쿼리 무효화 (검색, 카테고리 등 모든 필터 조건)
      queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
      
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
      
      // 3. 생성된 게시글의 개별 캐시도 설정
      if (newPost.id) {
        queryClient.setQueryData(postQueryKeys.detail(newPost.id), newPost);
      }
      if (newPost.slug) {
        queryClient.setQueryData(postQueryKeys.detail(newPost.slug), newPost);
      }
    },
    retry: 1,
  });
}

// 포스트 수정 뮤테이션 훅
export function useUpdatePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => 
      postsAPI.updatePost(id, data),
    onSuccess: (updatedPost) => {
      // 개별 포스트 캐시 업데이트
      queryClient.setQueryData(postQueryKeys.detail(updatedPost.id), updatedPost);
      if (updatedPost.slug) {
        queryClient.setQueryData(postQueryKeys.detail(updatedPost.slug), updatedPost);
      }
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
    },
    retry: 1,
  });
}

// 포스트 삭제 뮤테이션 훅
export function useDeletePost() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: postsAPI.deletePost,
    onSuccess: (_, deletedId) => {
      // 삭제된 포스트 캐시 제거
      queryClient.removeQueries({ queryKey: postQueryKeys.detail(deletedId) });
      // 목록 캐시 무효화
      queryClient.invalidateQueries({ queryKey: postQueryKeys.lists() });
    },
    retry: 1,
  });
}

// 포스트 좋아요 토글 뮤테이션 훅 (권장: 로그인 체크/낙관적 업데이트/롤백 일원화)
export function useTogglePostLike(slug: string | number, onRequireLogin?: () => void) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: (postId: number) => {
      if (!user) {
        if (onRequireLogin) onRequireLogin();
        // 즉시 에러 발생시켜 onError로 분기
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return postsAPI.toggleLike(postId);
    },
    onMutate: () => {
      // 낙관적 업데이트: liked/likeCount
      queryClient.setQueryData(postQueryKeys.detail(slug), (old: Post | undefined) => {
        if (!old) return old;
        const liked = !old.liked;
        let likeCount = old.likeCount + (liked ? 1 : -1);
        if (likeCount < 0) likeCount = 0;
        return { ...old, liked, likeCount };
      });
    },
    onError: (_, __, context) => {
      // 롤백: 원래 데이터로 복구
      queryClient.invalidateQueries({ queryKey: postQueryKeys.detail(slug) });
    },
    onSuccess: (response) => {
      // 서버 응답에 따라 liked/likeCount 동기화
      queryClient.setQueryData(postQueryKeys.detail(slug), (old: Post | undefined) => {
        if (!old) return old;
        const liked = response.liked;
        let likeCount = old.likeCount;
        if (liked && !old.liked) likeCount = old.likeCount + 1;
        if (!liked && old.liked) likeCount = Math.max(0, old.likeCount - 1);
        return { ...old, liked, likeCount };
      });
    },
    retry: 1,
  });
}

// 포스트 프리페치 유틸리티
export function usePrefetchPost() {
  const queryClient = useQueryClient();
  return (slugOrId: string | number) => {
    queryClient.prefetchQuery({
      queryKey: postQueryKeys.detail(slugOrId),
      queryFn: () => postsAPI.getPostBySlug(slugOrId.toString()),
      ...commonQueryOptions,
    });
  };
}

// 여러 포스트의 좋아요 상태를 10분간 모아뒀다가 한 번에 서버로 전송하는 배치 훅
// (debounce: 10분, 여러 포스트 동시 지원)
export function useBatchLikeManager() {
  // { [postId]: liked }
  const pendingLikesRef = useRef<Record<number, boolean>>({});
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
  const updateLike = useCallback((postId: number, liked: boolean) => {
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