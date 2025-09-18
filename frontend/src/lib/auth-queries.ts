import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, LoginForm, RegisterForm } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * TanStack Query 기반 인증 시스템
 * - 네트워크 요청 자동 중복 제거
 * - 5분 캐싱으로 불필요한 재요청 방지
 * - 에러 재시도 제어
 * - 옵티미스틱 업데이트
 */

// API 헬퍼 함수
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// 쿼리 키 팩토리
export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
  session: () => [...authQueryKeys.all, 'session'] as const,
};

// 사용자 정보 조회
export const useUser = () => {
  return useQuery({
    queryKey: authQueryKeys.user(),
    queryFn: () => apiRequest<User>('/auth/me'),
    staleTime: 5 * 60 * 1000, // 5분간 fresh
    gcTime: 10 * 60 * 1000, // 10분간 캐시 보관
    retry: false, // 인증 실패시 재시도 안함
    refetchOnWindowFocus: false, // 윈도우 포커스시 재요청 안함
    refetchOnMount: false, // 컴포넌트 마운트시 재요청 안함
  });
};

// 로그인 뮤테이션
export const useLogin = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginForm) =>
      apiRequest<{ user: User }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
    onSuccess: (data) => {
      // 사용자 정보 캐시 업데이트
      queryClient.setQueryData(authQueryKeys.user(), data.user);

      // 사용자 블로그 정보 무효화 (재조회 트리거)
      queryClient.invalidateQueries({ queryKey: ['blogs', 'my-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['user-blog'] });
    },
    onError: (error) => {
      console.error('Login failed:', error);
    },
  });
};

// 회원가입 뮤테이션
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: RegisterForm) =>
      apiRequest<{ user: User }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    onSuccess: (data) => {
      // 사용자 정보 캐시 업데이트
      queryClient.setQueryData(authQueryKeys.user(), data.user);

      // 블로그 정보 무효화
      queryClient.invalidateQueries({ queryKey: ['blogs', 'my-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['user-blog'] });
    },
  });
};

// 로그아웃 뮤테이션
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest('/auth/logout', {
        method: 'POST',
      }),
    onSuccess: () => {
      // 모든 인증 관련 캐시 제거
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      queryClient.removeQueries({ queryKey: ['blogs', 'my-blogs'] });
      queryClient.removeQueries({ queryKey: ['user-blog'] });

      // 레거시 localStorage 정리 (호환성)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    },
    onSettled: () => {
      // 성공/실패 여부와 관계없이 사용자 정보 제거
      queryClient.setQueryData(authQueryKeys.user(), null);
    },
  });
};

// 사용자 정보 새로고침
export const useRefreshUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<User>('/auth/me'),
    onSuccess: (data) => {
      queryClient.setQueryData(authQueryKeys.user(), data);
    },
    onError: () => {
      // 새로고침 실패시 로그아웃 처리
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
    },
  });
};

// 인증 상태 확인 헬퍼
export const useIsAuthenticated = () => {
  const { data: user } = useUser();
  return !!user;
};

// 관리자 권한 확인 헬퍼
export const useIsAdmin = () => {
  const { data: user } = useUser();
  return user?.role?.toLowerCase() === 'admin';
};

// 초기 인증 상태 프리페치 (SSR/SSG용)
export const prefetchAuth = async (queryClient: any) => {
  try {
    await queryClient.prefetchQuery({
      queryKey: authQueryKeys.user(),
      queryFn: () => apiRequest<User>('/auth/me'),
      staleTime: 5 * 60 * 1000,
    });
  } catch (error) {
    // 인증 실패는 정상적인 케이스
    console.log('Auth prefetch: User not authenticated');
  }
};