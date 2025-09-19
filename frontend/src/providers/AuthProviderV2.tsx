'use client';

import { createContext, useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthV2 } from '@/hooks/useAuthV2';
import { prefetchAuth } from '@/lib/auth/queries';
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

  // 초기 인증 상태 확인 (한 번만)
  useEffect(() => {
    // TanStack Query가 자동으로 처리하므로 추가 로직 불필요
    // 첫 렌더링시 자동으로 /auth/me 호출됨
  }, []);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

// 기존 코드와의 호환성을 위한 export
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Context 없이도 작동하도록 fallback
    return useAuthV2();
  }
  return context;
}

// SSR/SSG를 위한 프리페치 함수
export async function prefetchAuthData(queryClient: any) {
  await prefetchAuth(queryClient);
}