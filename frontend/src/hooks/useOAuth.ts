'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { mixpanel } from '@/lib/mixpanel';

export type OAuthProvider = 'google' | 'kakao' | 'github';

interface UseOAuthOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  returnUrl?: string;
}

export function useOAuth(options: UseOAuthOptions = {}) {
  const [isLoading, setIsLoading] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const handleOAuthLogin = useCallback(async (provider: OAuthProvider) => {
    try {
      setIsLoading(provider);
      setError(null);

      // 현재 페이지 또는 지정된 return URL 저장
      const returnUrl = options.returnUrl || window.location.pathname;
      sessionStorage.setItem('redirectAfterLogin', returnUrl);

      // API URL 구성
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const authUrl = `${baseUrl}/auth/${provider}`;

      // 개발 환경에서 URL 확인
      if (process.env.NODE_ENV === 'development') {
        console.log(`OAuth redirect to: ${authUrl}`);
      }

      // Mixpanel: OAuth 로그인 시작 추적
      mixpanel.track('User Login', { method: provider });

      // OAuth 제공자 페이지로 리디렉션
      // replace를 사용하여 로그인 페이지를 히스토리에서 대체
      window.location.replace(authUrl);

      // 성공 콜백 (실제로는 리디렉션 되므로 실행되지 않음)
      options.onSuccess?.();
    } catch (err) {
      const error = err instanceof Error ? err : new Error('OAuth 로그인 실패');
      setError(error);
      setIsLoading(null);
      
      // 에러 표시
      toast.error(error.message || '로그인에 실패했습니다. 다시 시도해주세요.');
      
      // 에러 콜백
      options.onError?.(error);
      
      console.error(`OAuth ${provider} login error:`, error);
    }
  }, [options]);

  const isProviderLoading = useCallback((provider: OAuthProvider): boolean => {
    return isLoading === provider;
  }, [isLoading]);

  const reset = useCallback(() => {
    setIsLoading(null);
    setError(null);
  }, []);

  return {
    handleOAuthLogin,
    isLoading: isLoading !== null,
    isProviderLoading,
    error,
    reset,
  };
}

// 개별 제공자용 편의 훅
export function useGoogleLogin(options?: UseOAuthOptions) {
  const { handleOAuthLogin, ...rest } = useOAuth(options);
  return {
    login: () => handleOAuthLogin('google'),
    ...rest,
  };
}

export function useKakaoLogin(options?: UseOAuthOptions) {
  const { handleOAuthLogin, ...rest } = useOAuth(options);
  return {
    login: () => handleOAuthLogin('kakao'),
    ...rest,
  };
}

export function useGitHubLogin(options?: UseOAuthOptions) {
  const { handleOAuthLogin, ...rest } = useOAuth(options);
  return {
    login: () => handleOAuthLogin('github'),
    ...rest,
  };
}