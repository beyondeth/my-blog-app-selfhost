'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { authQueryKeys, prefetchAuth } from '@/lib/profile-queries';
import { emitLogout } from '@/lib/auth/events';
import type { AuthContextType } from '@/types';

/**
 * TanStack Query 기반 AuthProvider
 * - 기존 Context API 인터페이스와 호환
 * - 내부적으로 TanStack Query 사용
 * - Provider는 호환성을 위해서만 존재 (실제 상태는 TanStack Query가 관리)
 */

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProviderV2({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const authValue = useAuthV2();
  const wasAuthenticatedRef = useRef(false);

  // 초기 인증 상태 확인 (한 번만)
  useEffect(() => {
    // TanStack Query가 자동으로 처리하므로 추가 로직 불필요
    // 첫 렌더링시 자동으로 /auth/me 호출됨
  }, []);

  // 인증 실패(401) 시 캐시/상태 정리
  useEffect(() => {
    if (authValue.isUnauthorized) {
      queryClient.setQueryData(authQueryKeys.user(), null);

      if (wasAuthenticatedRef.current) {
        emitLogout();
      }
    }

    wasAuthenticatedRef.current = authValue.isAuthenticated;
  }, [authValue.isAuthenticated, authValue.isUnauthorized, queryClient]);

  // 소셜 로그인 후 MCP OAuth 자동 완료 처리
  // sessionStorage에 mcpOAuth 데이터가 있고, 인증된 상태면 MCP OAuth 완료 처리
  useEffect(() => {
    const handleMcpOAuthCompletion = async () => {
      // 서버 사이드에서는 실행하지 않음
      if (typeof window === 'undefined') return;

      const mcpOAuthData = sessionStorage.getItem('mcpOAuth');

      // MCP OAuth 데이터가 있고, 인증된 상태인 경우에만 처리
      if (mcpOAuthData && authValue.isAuthenticated) {
        // 즉시 삭제하여 중복 처리 방지
        sessionStorage.removeItem('mcpOAuth');

        try {
          const { state, callback_url } = JSON.parse(mcpOAuthData);

          // state와 callback_url이 모두 있어야 유효한 MCP OAuth 요청
          if (!state || !callback_url) {
            console.warn('Invalid MCP OAuth data in sessionStorage');
            return;
          }

          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
          const response = await fetch(`${apiUrl}/auth/oauth/mcp/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, callback_url }),
          });

          if (!response.ok) {
            throw new Error('MCP OAuth 완료 실패');
          }

          const data = await response.json();

          if (data.success && data.redirect_url) {
            // MCP Proxy callback으로 리다이렉트 (Claude로 돌아감)
            window.location.href = data.redirect_url;
          }
        } catch (error) {
          console.error('MCP OAuth completion error:', error);
          // 에러 발생 시 일반 흐름으로 계속 진행 (사용자에게 알림 없음)
        }
      }
    };

    handleMcpOAuthCompletion();
  }, [authValue.isAuthenticated]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

// 기존 코드와의 호환성을 위한 export
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  const fallbackAuth = useAuthV2();
  return context ?? fallbackAuth;
}

// SSR/SSG를 위한 프리페치 함수
export async function prefetchAuthData(queryClient: any) {
  await prefetchAuth(queryClient);
}
