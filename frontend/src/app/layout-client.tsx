'use client';

import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import BottomNavBar from '@/components/layout/BottomNavBar';
import MainContent from '@/components/layout/MainContent';
import ClientProviders from '@/components/ClientProviders';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from 'sonner';
import { DMModalProvider } from '@/components/dm/DMModalProvider';
import { MusicProvider } from '@/providers/MusicProvider';
import { MusicPlayerDropdown } from '@/components/music';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { initMixpanel } from '@/lib/mixpanel';
import Script from 'next/script';
import { Debug } from '@/components/debug/Debug';
import { CacheClearButton } from '@/components/CacheClearButton';

interface LayoutClientProps {
  children: React.ReactNode;
}

/**
 * 클라이언트 사이드 레이아웃 컴포넌트
 *
 * 경로별 동적 레이아웃 제어:
 * - 인증 페이지: 헤더/사이드바 숨김
 * - 랜딩 페이지: 헤더만 표시
 * - 일반 페이지: 전체 레이아웃 (헤더 + 사이드바 + 하단바)
 */
export default function LayoutClient({ children }: LayoutClientProps) {
  const pathname = usePathname();
  const [shouldHideLayout, setShouldHideLayout] = useState(false);
  const [isLandingPage, setIsLandingPage] = useState(false);
  const isHomePage = pathname === '/';

  // 경로별 레이아웃 제어 로직
  // 중요: 함수형 업데이트로 의존성에서 상태 제거 (pathname 변경 시만 실행)
  // 상태가 의존성에 있으면 pathname 변경 → setState → 다시 useEffect 실행 → 이중 리렌더링 발생
  // (Header 리렌더링 → 음악 끊김/UI 깜빡임 문제 해결)
  useEffect(() => {
    let newShouldHide = false;
    let newIsLanding = false;

    // 커스텀 레이아웃 페이지: 전역 헤더/사이드바 숨김
    const layoutlessPaths = [
      '/mock-home-shell',
      '/mock-home-shell-ko',
      '/mock-home-shell-ink',
      '/mock-home-shell-harbor',
      '/mock-home-shell-harbor-white',
    ];
    const isLayoutlessPage = layoutlessPaths.includes(pathname);

    if (isLayoutlessPage) {
      newShouldHide = true;
      newIsLanding = false;
    } else if (pathname === '/landing') {
      // 랜딩페이지 - 헤더만 표시, 사이드바 제거
      newShouldHide = false;
      newIsLanding = true;
    } else {
      newIsLanding = false;

      // 인증 페이지 목록
      const authPaths = ['/login', '/register', '/consent', '/forgot-password', '/reset-password'];
      const isAuthPage = authPaths.some(path => pathname.startsWith(path));

      // 법적 문서 페이지 목록
      const legalPaths = [
        '/legal/terms',
        '/legal/privacy',
        '/legal/marketing-consent',
        '/legal/newsletter-consent',
        '/legal/guidelines',
      ];

      // 현재 페이지가 법적 문서 페이지인지 확인
      const isLegalPage = legalPaths.some(path => pathname.startsWith(path));

      // 인증 페이지는 항상 레이아웃 숨김
      if (isAuthPage) {
        newShouldHide = true;
      } else if (isLegalPage) {
        // 법적 문서 페이지: sessionStorage 체크
        const fromAuth = sessionStorage.getItem('from-auth') === 'true';
        newShouldHide = fromAuth;
      } else {
        // 일반 페이지로 이동 시 sessionStorage 초기화
        sessionStorage.removeItem('from-auth');
        sessionStorage.removeItem('auth-pathname');
        newShouldHide = false;
      }
    }

    // 함수형 업데이트: 이전 값과 비교하여 변경 시에만 업데이트
    // 의존성 배열에서 상태 제거하여 이중 실행 방지
    setShouldHideLayout(prev => prev !== newShouldHide ? newShouldHide : prev);
    setIsLandingPage(prev => prev !== newIsLanding ? newIsLanding : prev);
  }, [pathname]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ClientProviders>
        <MusicProvider>
          <DMModalProvider>
            <CacheClearButton />
            <Debug />

            {/* Header: 항상 렌더링, 조건에 따라 CSS 숨김 처리 (언마운트 방지) */}
            {/* 음악 플레이어 버튼만 Header에 있고, 드롭다운은 Portal로 body에 직접 렌더링 */}
            {/* Suspense 제거: useSearchParams는 Header 내부에서 개별 Suspense 처리 */}
            {!shouldHideLayout && (
              <>
                <Header />
                <div className="h-[72px]" />
              </>
            )}

            {/* 메인 콘텐츠 영역: 조건부 렌더링 유지 */}
            {shouldHideLayout ? (
              // 인증 페이지 또는 법적 문서 페이지(인증에서 온 경우): 사이드바 없이 콘텐츠만
              <div className="min-h-screen bg-white dark:bg-[#0E141B]">
                <MainContent>
                  {children}
                </MainContent>
              </div>
            ) : isLandingPage ? (
              // 랜딩페이지: 사이드바/하단바 제거
              <div className="min-h-screen bg-white dark:bg-[#0E141B]">
                <div className="w-full">
                  {children}
                </div>
              </div>
            ) : (
              // 일반 레이아웃: 사이드바 + 메인 콘텐츠 + 하단 바텀바
              <div className={shouldHideLayout ? '' : 'relative'}>
                <div
                  className="flex min-h-[calc(100vh-72px)] bg-white dark:bg-[#0E141B]"
                  style={{ border: 'none', transition: 'none' }}
                >
                  <LeftSidebar />
                  {/* 왼쪽 사이드바 영역 확보: translate-x-[23px] + w-20 = 103px, 여유 25px 포함 = 128px */}
                  <MainContent>
                    {children}
                  </MainContent>
                </div>
                {/* 모바일 하단 네비게이션 바 */}
                <BottomNavBar />
              </div>
            )}

            {/* 음악 플레이어 드롭다운: Portal로 body에 직접 렌더링 (Header 리렌더링과 완전 분리)
                페이지 이동 시에도 음악 재생이 끊기지 않도록 최상위 레벨에 배치 */}
            <MusicPlayerDropdown />

            <Toaster
              position="top-center"
              richColors
              expand={false}
              gap={16}
            />
            {/* <PerformanceMonitor /> */}
          </DMModalProvider>
        </MusicProvider>
      </ClientProviders>

      {/* Google Analytics 4 (gtag.js) */}
      {process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID}');
            `}
          </Script>
        </>
      )}
    </ThemeProvider>
  );
}
