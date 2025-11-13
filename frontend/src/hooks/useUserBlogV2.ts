'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useUser } from '@/lib/profile-queries';
import type { Blog } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * TanStack Query 기반 useUserBlog
 * - 자동 캐싱 및 중복 요청 제거
 * - window.dispatchEvent 제거
 * - query invalidation으로 새로고침 처리
 */

// 쿼리 키


// 블로그 데이터 페칭 함수
async function fetchUserBlog(): Promise<Blog | null> {
  const response = await fetch(
    `${API_URL}/blogs/my-blogs`,
    {
      credentials: 'include',
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      return null; // 블로그 없음
    }
    throw new Error('Failed to fetch user blog');
  }

  const blog = await response.json();
  // 이제 API는 단일 블로그 객체를 직접 반환
  return blog;
}

export function useUserBlogV2() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isLoading: userLoading } = useUser();

  // 블로그 데이터 쿼리
  const {
    data: blog,
    isLoading: blogLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['user-blog', user?.id],
    queryFn: fetchUserBlog,
    enabled: !!user, // 사용자가 있을 때만 실행
    staleTime: 0, // 캐시를 즉시 만료시켜 최신 데이터 유지
    gcTime: 0, // 캐시를 즉시 제거
    refetchOnWindowFocus: false,
    refetchOnMount: true, // 마운트시 항상 재요청하여 최신 데이터 확보
    // 이전 데이터를 placeholderData로 사용하여 로딩 중에도 표시
    placeholderData: (previousData) => previousData,
  });

  // 전체 로딩 상태
  const loading = userLoading || blogLoading;

  // 리다이렉션 체크 함수
  const checkAndRedirect = async (): Promise<string> => {
    if (userLoading) {
      return '/'; // 로딩 중이면 홈으로
    }

    if (!user) {
      return '/login';
    }

    if (blog) {
      return `/new-story`;
    }

    // 블로그가 없는 경우 (신규 사용자는 자동 생성되므로 발생하지 않아야 함)
    console.error('User does not have a blog. This should not happen for new users.');
    return '/';
  };

  // 수동 새로고침 함수
  const refresh = () => {
    // TanStack Query의 refetch 사용
    return refetch();
  };

  // Debug logging
  if (user) {
    console.log('[useUserBlogV2] User:', user.id, user.email);
    console.log('[useUserBlogV2] Blog data:', blog);
    console.log('[useUserBlogV2] Loading:', loading, 'Error:', error);
  }

  return {
    blog: blog || null,
    loading,
    error: error?.message || null,
    checkAndRedirect,
    refresh,
  };
}

// 블로그 정보 무효화 함수 (외부에서 사용)
export function invalidateUserBlog(queryClient: any) {
  queryClient.invalidateQueries({ queryKey: ['user-blog'] });
}

// window.dispatchEvent 대체 - TanStack Query invalidation 사용
export function refreshUserBlog(queryClient: any) {
  invalidateUserBlog(queryClient);
}