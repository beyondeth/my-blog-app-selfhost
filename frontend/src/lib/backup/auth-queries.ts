import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { User, LoginForm, RegisterForm } from '@/types';
import { authEvents, emitLogin, emitLogout, emitTokenRefreshed, emitAuthError } from './auth-events';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * TanStack Query 기반 인증 시스템
 * - 네트워크 요청 자동 중복 제거
 * - 5분 캐싱으로 불필요한 재요청 방지
 * - 에러 재시도 제어
 * - 옵티미스틱 업데이트
 */

// Silent Refresh 상태 관리
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
let refreshRetryCount = 0;
const MAX_REFRESH_RETRY = 2;

// 토큰 갱신 함수
async function refreshAccessToken(): Promise<void> {
  console.log('[Auth] Attempting to refresh access token');

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('[Auth] Token refresh failed:', response.status);
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || 'Token refresh failed');
  }

  const data = await response.json();
  console.log('[Auth] Token refreshed successfully');

  // 갱신 성공 시 재시도 카운트 초기화
  refreshRetryCount = 0;

  return data;
}

// API 헬퍼 함수 with Silent Refresh
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
  retry = true
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // 401 Unauthorized - 액세스 토큰 만료
  if (response.status === 401 && retry && !endpoint.includes('/auth/')) {
    console.log(`[Auth] 401 Unauthorized on ${endpoint}, attempting token refresh`);

    // 재시도 횟수 초과 체크
    if (refreshRetryCount >= MAX_REFRESH_RETRY) {
      console.error('[Auth] Max refresh retry exceeded');
      refreshRetryCount = 0;
      emitAuthError('Session expired');
      emitLogout();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
      throw new Error('Session expired');
    }

    // 이미 갱신 중이면 기다림
    if (isRefreshing && refreshPromise) {
      console.log('[Auth] Already refreshing, waiting for completion');
      try {
        await refreshPromise;
        // 갱신 완료 후 원래 요청 재시도
        return apiRequest<T>(endpoint, options, false);
      } catch (error) {
        console.error('[Auth] Token refresh failed while waiting');
        throw error;
      }
    }

    // 갱신 시작
    isRefreshing = true;
    refreshRetryCount++;
    console.log(`[Auth] Starting token refresh (attempt ${refreshRetryCount}/${MAX_REFRESH_RETRY})`);

    refreshPromise = refreshAccessToken()
      .then(() => {
        isRefreshing = false;
        refreshPromise = null;
        // 토큰 갱신 성공 이벤트
        emitTokenRefreshed();
        console.log('[Auth] Token refresh completed successfully');
      })
      .catch((error) => {
        isRefreshing = false;
        refreshPromise = null;
        console.error('[Auth] Token refresh failed:', error.message);

        // 갱신 실패 시에도 재시도가 가능하면 에러만 throw
        if (refreshRetryCount < MAX_REFRESH_RETRY) {
          throw error;
        }

        // 최종 실패 시 로그아웃 처리
        refreshRetryCount = 0;
        emitAuthError('Token refresh failed');
        emitLogout();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          // 로그인 페이지로 리다이렉트
          window.location.href = '/login';
        }
        throw error;
      });

    try {
      await refreshPromise;
      // 갱신 성공 후 원래 요청 재시도
      console.log('[Auth] Retrying original request after successful refresh');
      return apiRequest<T>(endpoint, options, false);
    } catch (error) {
      console.error('[Auth] Failed to retry request after refresh');
      throw new Error('Authentication required');
    }
  }

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
    retry: 1, // 인증 실패시 1번만 재시도 (토큰 갱신 기회 제공)
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

      // 로그인 이벤트 발생
      emitLogin(data.user);

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

      // 회원가입 후 자동 로그인 이벤트
      emitLogin(data.user);

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
      console.log('[Auth] Logout successful');

      // 재시도 카운트 초기화
      refreshRetryCount = 0;

      // 모든 인증 관련 캐시 제거
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      queryClient.removeQueries({ queryKey: ['blogs', 'my-blogs'] });
      queryClient.removeQueries({ queryKey: ['user-blog'] });

      // 로그아웃 이벤트 발생
      emitLogout();

      // 레거시 localStorage 정리 (호환성)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    },
    onError: (error) => {
      console.error('[Auth] Logout failed:', error);
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