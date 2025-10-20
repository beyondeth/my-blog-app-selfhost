/**
 * 인증 관련 React Query 훅
 * @description TanStack Query를 사용한 인증 상태 관리 및 API 호출
 * 자동 토큰 갱신, 캐싱, 옵티미스틱 업데이트 지원
 */

import { useMutation, useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import type { User, LoginForm, RegisterForm } from '@/types';
import { authEvents, emitLogin, emitLogout, emitTokenRefreshed, emitAuthError } from './events';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 토큰 갱신 관리 상태
 * @description 동시 다발적인 401 에러 시 중복 갱신 방지
 */
let isRefreshing = false;
let refreshPromise: Promise<void> | null = null;
let refreshRetryCount = 0;
const MAX_REFRESH_RETRY = 2;

/**
 * 액세스 토큰 갱신
 * @returns 갱신 완료 Promise
 * @throws 갱신 실패 시 에러
 */
async function refreshAccessToken(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth] 액세스 토큰 갱신 시도');
  }

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include', // HttpOnly 쿠키 포함
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error('[Auth] 토큰 갱신 실패:', response.status);
    const error = await response.json().catch(() => ({ message: '알 수 없는 오류' }));
    throw new Error(error.message || '토큰 갱신 실패');
  }

  const data = await response.json();

  if (process.env.NODE_ENV === 'development') {
    console.log('[Auth] 토큰 갱신 성공');
  }

  // 갱신 성공 시 재시도 카운트 초기화
  refreshRetryCount = 0;

  return data;
}

/**
 * API 요청 헬퍼 (자동 토큰 갱신 포함)
 * @param endpoint - API 엔드포인트
 * @param options - fetch 옵션
 * @param retry - 토큰 갱신 후 재시도 여부
 * @returns API 응답 데이터
 * @throws API 오류
 */
async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit,
  retry = true
): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    credentials: 'include', // HttpOnly 쿠키 포함
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  // 401 Unauthorized - 토큰 만료
  if (response.status === 401 && retry && !endpoint.includes('/auth/')) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth] 401 오류 발생 (${endpoint}), 토큰 갱신 시도`);
    }

    // 재시도 횟수 초과 체크
    if (refreshRetryCount >= MAX_REFRESH_RETRY) {
      console.error('[Auth] 최대 갱신 재시도 횟수 초과');
      refreshRetryCount = 0;
      emitAuthError('세션이 만료되었습니다');
      emitLogout();

      // 레거시 localStorage 정리
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      throw new Error('세션이 만료되었습니다');
    }

    // 이미 갱신 중이면 대기
    if (isRefreshing && refreshPromise) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] 이미 토큰 갱신 중, 대기...');
      }

      try {
        await refreshPromise;
        // 갱신 완료 후 원래 요청 재시도
        return apiRequest<T>(endpoint, options, false);
      } catch (error) {
        console.error('[Auth] 토큰 갱신 실패 (대기 중)');
        throw error;
      }
    }

    // 토큰 갱신 시작
    isRefreshing = true;
    refreshRetryCount++;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Auth] 토큰 갱신 시작 (시도 ${refreshRetryCount}/${MAX_REFRESH_RETRY})`);
    }

    refreshPromise = refreshAccessToken()
      .then(() => {
        isRefreshing = false;
        refreshPromise = null;
        emitTokenRefreshed(); // 토큰 갱신 이벤트 발생

        if (process.env.NODE_ENV === 'development') {
          console.log('[Auth] 토큰 갱신 완료');
        }
      })
      .catch((error) => {
        isRefreshing = false;
        refreshPromise = null;
        console.error('[Auth] 토큰 갱신 실패:', error.message);

        // 재시도 가능하면 에러만 throw
        if (refreshRetryCount < MAX_REFRESH_RETRY) {
          throw error;
        }

        // 최종 실패 시 로그아웃 처리
        refreshRetryCount = 0;
        emitAuthError('토큰 갱신 실패');
        emitLogout();

        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }

        throw error;
      });

    try {
      await refreshPromise;
      // 갱신 성공 후 원래 요청 재시도
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] 원본 요청 재시도');
      }
      return apiRequest<T>(endpoint, options, false);
    } catch (error) {
      console.error('[Auth] 갱신 후 재시도 실패');
      throw new Error('인증이 필요합니다');
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '요청 실패' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * React Query 키 팩토리
 * @description 일관된 쿼리 키 구조를 위한 팩토리
 */
export const authQueryKeys = {
  all: ['auth'] as const,
  user: () => [...authQueryKeys.all, 'user'] as const,
  session: () => [...authQueryKeys.all, 'session'] as const,
};

// ==================== React Query 훅 ====================

/**
 * 현재 사용자 정보 조회
 * @returns 사용자 정보 쿼리 결과
 *
 * @example
 * ```typescript
 * const { data: user, isLoading, error } = useUser();
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <LoginPage />;
 * if (user) return <Dashboard user={user} />;
 * ```
 */
export const useUser = () => {
  return useQuery({
    queryKey: authQueryKeys.user(),
    queryFn: () => apiRequest<User>('/auth/me'),
    staleTime: 5 * 60 * 1000,     // 5분간 fresh 상태 유지
    gcTime: 10 * 60 * 1000,        // 10분간 캐시 보관
    retry: 1,                      // 인증 실패 시 1번만 재시도
    refetchOnWindowFocus: false,   // 윈도우 포커스 시 재요청 안함
    refetchOnMount: false,         // 마운트 시 재요청 안함 (성능 최적화 - staleTime 활용)
    placeholderData: (previousData) => previousData,  // 리페칭 중에도 이전 데이터 유지 (깜빡임 방지)
  });
};

/**
 * 로그인 뮤테이션
 * @returns 로그인 뮤테이션 객체
 *
 * @example
 * ```typescript
 * const loginMutation = useLogin();
 *
 * const handleLogin = async (credentials: LoginForm) => {
 *   try {
 *     await loginMutation.mutateAsync(credentials);
 *     router.push('/dashboard');
 *   } catch (error) {
 *     toast.error('로그인 실패');
 *   }
 * };
 * ```
 */
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

      // 로그인 이벤트 발생 (WebSocket 연결 등)
      emitLogin(data.user);

      // 블로그 정보 무효화 (재조회 트리거)
      queryClient.invalidateQueries({ queryKey: ['blogs', 'my-blogs'] });
      queryClient.invalidateQueries({ queryKey: ['user-blog'] });
    },
    onError: (error) => {
      console.error('로그인 실패:', error);
    },
  });
};

/**
 * 회원가입 뮤테이션
 * @returns 회원가입 뮤테이션 객체
 */
export const useRegister = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: RegisterForm) =>
      apiRequest<{ user: User; blog?: any }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      }),
    onSuccess: (data) => {
      // 사용자 정보 캐시 업데이트
      queryClient.setQueryData(authQueryKeys.user(), data.user);

      // 블로그 정보가 있으면 캐시에 저장 (근본적 해결)
      if (data.blog) {
        queryClient.setQueryData(['user-blog'], data.blog);
      }

      // 회원가입 후 자동 로그인 이벤트
      emitLogin(data.user);
    },
    onError: (error) => {
      console.error('회원가입 실패:', error);
    },
  });
};

/**
 * 로그아웃 뮤테이션
 * @returns 로그아웃 뮤테이션 객체
 */
export const useLogout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiRequest('/auth/logout', {
        method: 'POST',
      }),
    onSuccess: () => {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Auth] 로그아웃 성공');
      }

      // 재시도 카운트 초기화
      refreshRetryCount = 0;

      // 모든 인증 관련 캐시 제거
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
      queryClient.removeQueries({ queryKey: ['blogs', 'my-blogs'] });
      queryClient.removeQueries({ queryKey: ['user-blog'] });

      // 로그아웃 이벤트 발생
      emitLogout();

      // 레거시 localStorage 정리 (하위 호환성)
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    },
    onError: (error) => {
      console.error('[Auth] 로그아웃 실패:', error);
    },
    onSettled: () => {
      // 성공/실패 여부와 관계없이 사용자 정보 제거
      queryClient.setQueryData(authQueryKeys.user(), null);
    },
  });
};

/**
 * 사용자 정보 새로고침
 * @returns 새로고침 뮤테이션 객체
 */
export const useRefreshUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiRequest<User>('/auth/me'),
    onSuccess: (data) => {
      // 캐시에 새 데이터 저장 (mutationFn이 이미 서버에서 최신 데이터 가져옴)
      queryClient.setQueryData(authQueryKeys.user(), { ...data });

      // 모든 useUser() 사용 컴포넌트에 업데이트 알림 (서버 요청 없이 리렌더링만)
      queryClient.invalidateQueries({
        queryKey: authQueryKeys.user(),
        refetchType: 'none'  // refetch 하지 않고 stale만 마킹하여 타이밍 이슈 방지
      });
    },
    onError: () => {
      // 새로고침 실패 시 로그아웃 처리
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
    },
  });
};

// ==================== 헬퍼 훅 ====================

/**
 * 인증 상태 확인
 * @returns 로그인 여부
 */
export const useIsAuthenticated = () => {
  const { data: user } = useUser();
  return !!user;
};

/**
 * 관리자 권한 확인
 * @returns 관리자 여부
 */
export const useIsAdmin = () => {
  const { data: user } = useUser();
  return user?.role?.toLowerCase() === 'admin';
};

// ==================== SSR/SSG 지원 ====================

/**
 * 초기 인증 상태 프리페치 (SSR/SSG용)
 * @param queryClient - React Query 클라이언트
 *
 * @example
 * ```typescript
 * // pages/_app.tsx or app/layout.tsx
 * export async function getServerSideProps() {
 *   const queryClient = new QueryClient();
 *   await prefetchAuth(queryClient);
 *
 *   return {
 *     props: {
 *       dehydratedState: dehydrate(queryClient),
 *     },
 *   };
 * }
 * ```
 */
export const prefetchAuth = async (queryClient: QueryClient) => {
  try {
    await queryClient.prefetchQuery({
      queryKey: authQueryKeys.user(),
      queryFn: () => apiRequest<User>('/auth/me'),
      staleTime: 5 * 60 * 1000,
    });
  } catch (error) {
    // 인증 실패는 정상적인 케이스
    if (process.env.NODE_ENV === 'development') {
      console.log('Auth prefetch: 사용자 미인증 상태');
    }
  }
};