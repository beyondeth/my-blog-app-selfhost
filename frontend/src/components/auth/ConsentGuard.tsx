'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { needsConsent } from '@/types';

/**
 * 약관 동의 가드 컴포넌트
 * OAuth 로그인 사용자가 약관 동의를 하지 않은 경우 /consent 페이지로 리다이렉트
 *
 * 제외 페이지:
 * - /consent: 약관 동의 페이지 자체
 * - /login, /register: 인증 페이지
 * - /auth/*: OAuth 콜백 페이지
 * - /legal/*: 법적 문서 페이지
 */
export default function ConsentGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // 로딩 중이거나 사용자가 없으면 무시
    if (isLoading || !user) {
      return;
    }

    // 제외할 페이지 경로
    const excludedPaths = [
      '/consent',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password',
    ];

    // 제외할 경로 패턴
    const excludedPatterns = [
      /^\/auth\//,        // OAuth 콜백 페이지
      /^\/legal\//,       // 법적 문서 페이지
      /^\/api\//,         // API 경로
    ];

    // 현재 경로가 제외 대상인지 확인
    const isExcluded =
      excludedPaths.includes(pathname) ||
      excludedPatterns.some((pattern) => pattern.test(pathname));

    // 제외 대상이 아니고 약관 동의가 필요한 경우 리다이렉트
    if (!isExcluded && needsConsent(user)) {
      router.push('/consent');
    }
  }, [user, isLoading, pathname, router]);

  return <>{children}</>;
}
