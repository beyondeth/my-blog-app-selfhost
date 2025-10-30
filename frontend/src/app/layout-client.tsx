'use client';

import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import BottomNavBar from '@/components/layout/BottomNavBar';
import MainContent from '@/components/layout/MainContent';
import ClientProviders from '@/components/ClientProviders';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from 'sonner';
import { DMModalProvider } from '@/components/dm/DMModalProvider';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { initMixpanel } from '@/lib/mixpanel';
import Script from 'next/script';

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

  // Mixpanel 초기화 (앱 시작 시 1회만 실행)
  useEffect(() => {
    initMixpanel();
  }, []);

  // 경로별 레이아웃 제어 로직
  useEffect(() => {
    // 랜딩페이지 - 헤더만 표시, 사이드바 제거
    if (pathname === '/landing') {
      setShouldHideLayout(false);
      setIsLandingPage(true);
      return;
    }

    setIsLandingPage(false);

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
      setShouldHideLayout(true);
    } else if (isLegalPage) {
      // 법적 문서 페이지: sessionStorage 체크
      const fromAuth = sessionStorage.getItem('from-auth') === 'true';
      setShouldHideLayout(fromAuth);
    } else {
      // 일반 페이지로 이동 시 sessionStorage 초기화
      sessionStorage.removeItem('from-auth');
      sessionStorage.removeItem('auth-pathname');
      setShouldHideLayout(false);
    }
  }, [pathname]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ClientProviders>
        <DMModalProvider>
          {shouldHideLayout ? (
            // 인증 페이지 또는 법적 문서 페이지(인증에서 온 경우): 헤더/사이드바 숨김
            <div className="min-h-screen bg-background">
              <MainContent>
                {children}
              </MainContent>
            </div>
          ) : isLandingPage ? (
            // 랜딩페이지: 헤더만 표시, 사이드바/하단바 제거
            <div className="min-h-screen bg-background">
              <Header />
              <div className="w-full">
                {children}
              </div>
            </div>
          ) : (
            // 일반 레이아웃: 헤더 + 사이드바 + 메인 콘텐츠 + 하단 바텀바
            <div>
              <Header />
              <div className="flex" style={{ border: 'none', transition: 'none' }}>
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
          <Toaster position="top-center" richColors />
          {/* <PerformanceMonitor /> */}
        </DMModalProvider>
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
