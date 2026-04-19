'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { needsConsent } from '@/types';
import { stripLocalePrefix } from '@/lib/i18n/config';
import { useLocaleContext } from '@/providers/LocaleProvider';

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
  const normalizedPathname = stripLocalePrefix(pathname || '/');
  const { user, isLoading } = useAuth();
  const { href } = useLocaleContext();
  const isRedirecting = useRef(false);
  const lastRedirectTime = useRef(0);

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
      '/logout',  // 로그아웃 경로 추가
    ];

    // 제외할 경로 패턴
    const excludedPatterns = [
      /^\/auth\//,        // OAuth 콜백 페이지
      /^\/legal\//,       // 법적 문서 페이지
      /^\/api\//,         // API 경로
    ];

    // 현재 경로가 제외 대상인지 확인
    const isExcluded =
      excludedPaths.includes(normalizedPathname) ||
      excludedPatterns.some((pattern) => pattern.test(normalizedPathname));

    // 세션 스토리지에서 consent 리디렉션 방지 플래그 확인
    const consentLock = sessionStorage.getItem('consent_redirect_lock');
    const currentTime = Date.now();

    // 5초 내의 중복 리디렉션 방지
    if (consentLock && currentTime - parseInt(consentLock) < 5000) {
      return;
    }

    // 이미 리디렉션 중이면 추가 리디렉션 방지
    if (isRedirecting.current) {
      return;
    }

    // 제외 대상이 아니고 약관 동의가 필요한 경우 리다이렉트
    if (!isExcluded && needsConsent(user)) {
      // 리디렉션 상태 설정
      isRedirecting.current = true;
      lastRedirectTime.current = currentTime;

      // 리디렉션 타임스탬프 저장
      sessionStorage.setItem('consent_redirect_lock', currentTime.toString());

      // 100ms 딜레이 후 리디렉션 (상태 업데이트 대기)
      setTimeout(() => {
        router.push(href('/consent'));
        // 1초 후 리디렉션 상태 초기화
        setTimeout(() => {
          isRedirecting.current = false;
        }, 1000);
      }, 100);
    }
  }, [user, isLoading, normalizedPathname, router, href]);

  // 컴포넌트 언마운트 시 리디렉션 상태 초기화
  useEffect(() => {
    return () => {
      isRedirecting.current = false;
    };
  }, []);

  return <>{children}</>;
}
