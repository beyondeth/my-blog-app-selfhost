'use client';

import { createContext, useContext, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { authQueryKeys, prefetchAuth } from '@/lib/profile-queries';
import { emitLogout } from '@/lib/auth/events';
import type { AuthContextType } from '@/types';
import {
  buildMcpOAuthConsentPath,
  clearMcpOAuthSession,
  readMcpOAuthSession,
} from '@/lib/mcpOAuth';

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
  const router = useRouter();
  const pathname = usePathname();

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

  // 소셜 로그인 후 MCP OAuth 승인 화면으로 연결
  useEffect(() => {
    if (typeof window === 'undefined' || !authValue.isAuthenticated) return;

    const mcpOAuthData = readMcpOAuthSession();
    if (!mcpOAuthData) return;

    if (!mcpOAuthData.state || !mcpOAuthData.callback_url) {
      clearMcpOAuthSession();
      return;
    }

    if (!authValue.user?.termsAcceptedAt || !authValue.user?.privacyAcceptedAt) {
      return;
    }

    if (pathname === '/auth/mcp-consent') {
      return;
    }

    if (pathname === '/consent') {
      return;
    }

    router.replace(buildMcpOAuthConsentPath(mcpOAuthData));
  }, [
    authValue.isAuthenticated,
    authValue.user?.termsAcceptedAt,
    authValue.user?.privacyAcceptedAt,
    pathname,
    router,
  ]);

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
