'use client';

import { useEffect } from 'react';
import { useUser } from '@/lib/profile-queries';
import { useAuth } from '@/providers/AuthProviderV2';

/**
 * 인증 상태 디버깅 훅 (개발 환경 전용)
 *
 * @description
 * - useUser와 useAuth 훅의 상태를 실시간으로 모니터링
 * - window.__AUTH_DEBUG__ 객체에 전역 접근 제공
 * - 프로필 이미지 문제 디버깅에 특화
 *
 * @example
 * ```tsx
 * // _app.tsx 또는 layout.tsx에서
 * if (process.env.NODE_ENV === 'development') {
 *   useAuthDebug();
 * }
 * ```
 */
export function useAuthDebug() {
  const userQuery = useUser();
  const authContext = useAuth();

  useEffect(() => {
    // 개발 환경에서만 실행
    if (process.env.NODE_ENV !== 'development') return;

    // 전역 디버그 객체 생성
    window.__AUTH_DEBUG__ = {
      // React Query 상태
      userQuery: {
        data: userQuery.data,
        isLoading: userQuery.isLoading,
        isError: userQuery.isError,
        error: userQuery.error,
        fetchStatus: userQuery.fetchStatus,
        isFetching: userQuery.isFetching,
        isRefetching: userQuery.isRefetching,
        lastUpdated: userQuery.dataUpdatedAt,
      },

      // Auth Context 상태
      authContext: {
        user: authContext.user,
        isLoading: authContext.isLoading,
        isAuthenticated: authContext.isAuthenticated,
      },

      // 편의 메서드
      methods: {
        logStates: () => {
          console.group('🔍 Auth Debug States');
          console.log('React Query State:', {
            user: userQuery.data,
            isLoading: userQuery.isLoading,
            fetchStatus: userQuery.fetchStatus,
            isStale: userQuery.isStale,
            lastUpdated: new Date(userQuery.dataUpdatedAt).toLocaleTimeString(),
          });
          console.log('Auth Context State:', {
            user: authContext.user,
            isAuthenticated: authContext.isAuthenticated,
          });
          console.groupEnd();
        },

        logProfileImage: () => {
          console.group('📸 Profile Image Debug');
          console.log('React Query Profile Image:', userQuery.data?.profileImage);
          console.log('Auth Context Profile Image:', authContext.user?.profileImage);
          console.log('Profile Image URLs:', {
            reactQuery: userQuery.data?.profileImage || 'undefined',
            authContext: authContext.user?.profileImage || 'undefined',
            areEqual: userQuery.data?.profileImage === authContext.user?.profileImage,
          });
          console.groupEnd();
        },

        compareUserObjects: () => {
          const queryUser = userQuery.data;
          const authUser = authContext.user;

          console.group('👥 User Objects Comparison');
          console.log('Objects are same reference:', queryUser === authUser);

          if (queryUser && authUser) {
            const keys = Object.keys(queryUser) as (keyof typeof queryUser)[];
            const differences = keys.filter(key => queryUser[key] !== authUser[key]);

            console.log('Different fields:', differences);
            differences.forEach(key => {
              console.log(`${key}:`, {
                queryUser: queryUser[key],
                authUser: authUser[key],
              });
            });
          }
          console.groupEnd();
        },

        forceRefresh: async () => {
          console.log('🔄 Forcing user refresh...');
          await userQuery.refetch();
        },
      },
    };

    // 초기 로깅
    console.log('🚀 Auth Debug initialized');
    console.log('Access via: window.__AUTH_DEBUG__');
    window.__AUTH_DEBUG__?.methods.logStates();
    window.__AUTH_DEBUG__?.methods.logProfileImage();

    // 일정 간격으로 상태 변경 감지
    const interval = setInterval(() => {
      const prevData = window.__AUTH_DEBUG__?.userQuery.data;
      const currData = userQuery.data;

      if (prevData !== currData) {
        console.log('📊 User data changed');
        if (window.__AUTH_DEBUG__) {
          window.__AUTH_DEBUG__.userQuery.data = currData;
          window.__AUTH_DEBUG__.methods.logStates();
        }
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      delete window.__AUTH_DEBUG__;
    };
  }, [userQuery, authContext]);

  // React Query 상태 변경 감지
  const hasData = !!userQuery.data;
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    console.log('🔄 React Query status changed:', {
      isLoading: userQuery.isLoading,
      isFetching: userQuery.isFetching,
      fetchStatus: userQuery.fetchStatus,
      hasData,
    });
  }, [userQuery.isLoading, userQuery.isFetching, userQuery.fetchStatus, hasData]);

  // Auth Context 상태 변경 감지
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    console.log('🔄 Auth Context changed:', {
      hasUser: !!authContext.user,
      userId: authContext.user?.id,
      profileImage: authContext.user?.profileImage,
    });
  }, [authContext.user]);
}

// 전역 타입 선언
declare global {
  interface Window {
    __AUTH_DEBUG__?: {
      userQuery: {
        data: any;
        isLoading: boolean;
        isError: boolean;
        error: any;
        fetchStatus: 'fetching' | 'paused' | 'idle';
        isFetching: boolean;
        isRefetching: boolean;
        lastUpdated: number;
      };
      authContext: {
        user: any;
        isLoading: boolean;
        isAuthenticated: boolean;
      };
      methods: {
        logStates: () => void;
        logProfileImage: () => void;
        compareUserObjects: () => void;
        forceRefresh: () => Promise<void>;
      };
    };
  }
}
