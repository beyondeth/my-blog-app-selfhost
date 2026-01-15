'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useUser,
  useLogin,
  useRegister,
  useLogout,
  useRefreshUser,
} from '@/lib/profile-queries';
import type { LoginForm, RegisterForm, AuthContextType } from '@/types';

/**
 * TanStack Query 기반 새로운 useAuth 훅
 * - 기존 useAuth와 동일한 인터페이스 제공 (호환성)
 * - 내부적으로 TanStack Query 사용
 * - 자동 캐싱과 중복 요청 제거
 */
export function useAuthV2(): AuthContextType {
  const router = useRouter();

  // TanStack Query 훅들
  const { data: user, isLoading: userLoading, error: userError } = useUser();
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const logoutMutation = useLogout();
  const refreshMutation = useRefreshUser();
  const isUnauthorized = userError?.message === 'Unauthorized';
  const normalizedUser = isUnauthorized ? null : user || null;
  const isAuthenticated = !!normalizedUser;
  const isAdmin = normalizedUser?.role?.toLowerCase() === 'admin';
  const authStatus = userLoading
    ? 'loading'
    : isAuthenticated
      ? 'authenticated'
      : isUnauthorized
        ? 'unauthenticated'
        : userError
          ? 'error'
          : 'unauthenticated';

  // 에러 상태 통합
  const error = userError?.message ||
                loginMutation.error?.message ||
                registerMutation.error?.message ||
                null;

  // 로딩 상태 통합
  const isLoading = userLoading ||
                    loginMutation.isPending ||
                    registerMutation.isPending ||
                    logoutMutation.isPending;

  // 로그인 함수
  const login = useCallback(async (credentials: LoginForm) => {
    try {
      await loginMutation.mutateAsync(credentials);
    } catch (error) {
      // 에러는 mutation 내부에서 처리됨
      throw error;
    }
  }, [loginMutation]);

  // 회원가입 함수
  const register = useCallback(async (userData: RegisterForm) => {
    try {
      await registerMutation.mutateAsync(userData);
    } catch (error) {
      throw error;
    }
  }, [registerMutation]);

  // 로그아웃 함수
  const logout = useCallback(async (redirectTo?: string) => {
    try {
      await logoutMutation.mutateAsync();
      if (redirectTo) {
        router.push(redirectTo);
      }
    } catch (error) {
      console.error('Logout error:', error);
      // 로그아웃은 실패해도 진행
      if (redirectTo) {
        router.push(redirectTo);
      }
    }
  }, [logoutMutation, router]);

  // 사용자 정보 새로고침
  const refreshUser = useCallback(async () => {
    try {
      await refreshMutation.mutateAsync();
    } catch (error) {
      console.error('Failed to refresh user:', error);
      // 새로고침 실패시 로그아웃
      await logout();
    }
  }, [refreshMutation, logout]);

  // 인증 상태 확인 (TanStack Query가 자동으로 처리)
  const checkAuth = useCallback(async () => {
    // TanStack Query가 자동으로 캐싱/중복 제거를 처리하므로
    // 추가 로직 불필요
    return Promise.resolve();
  }, []);

  // 에러 클리어
  const clearError = useCallback(() => {
    loginMutation.reset();
    registerMutation.reset();
  }, [loginMutation, registerMutation]);

  // 반환값 메모이제이션: 의존성이 변경되지 않으면 동일한 객체 참조 유지
  // → Context consumer 불필요한 리렌더링 방지
  return useMemo(
    () => ({
      user: normalizedUser,
      isLoading,
      isAuthenticated,
      authStatus,
      isUnauthorized,
      isAdmin,
      login,
      register,
      logout,
      refreshUser,
      checkAuth,
      clearError,
      error: error as string | null,
    }),
    [
      normalizedUser,
      isLoading,
      isAuthenticated,
      authStatus,
      isUnauthorized,
      isAdmin,
      login,
      register,
      logout,
      refreshUser,
      checkAuth,
      clearError,
      error,
    ]
  );
}

/**
 * Provider 없이 사용 가능한 버전
 * TanStack Query는 Provider를 통해 이미 캐시를 관리하므로
 * 추가 Provider가 필요 없음
 */
export function useAuth() {
  return useAuthV2();
}
