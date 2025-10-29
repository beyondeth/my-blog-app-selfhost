'use client';

import "./globals.css";
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import BottomNavBar from '@/components/layout/BottomNavBar';
import MainContent from '@/components/layout/MainContent';
import ClientProviders from '@/components/ClientProviders';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from 'sonner';
// import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { DMModalProvider } from '@/components/dm/DMModalProvider';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [shouldHideLayout, setShouldHideLayout] = useState(false);
  const [isLandingPage, setIsLandingPage] = useState(false);

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* Pretendard Font - preload for LCP optimization */}
        <link
          rel="preload"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
          as="style"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
          crossOrigin=""
        />
        {/* Google Fonts - Orbitron for Logo */}
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* GeistMono Font */}
        <link
          rel="stylesheet"
          href="/fonts/geistmono.css"
        />
        {/* FOUC 방지 스크립트 - 테마 깜빡임 방지 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // localStorage에서 테마 가져오기
                  const theme = localStorage.getItem('theme');

                  if (theme === 'dark' || theme === 'light') {
                    // 저장된 테마 적용
                    document.documentElement.classList.add(theme);
                  } else {
                    // 시스템 테마 감지
                    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                    document.documentElement.classList.add(systemTheme);
                  }
                } catch (e) {
                  // localStorage 접근 실패 시 라이트 모드로 폴백
                  document.documentElement.classList.add('light');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className="bg-background text-foreground"
        style={{
          fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif'
        }}
        suppressHydrationWarning={true}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
        >
          <ClientProviders>
            <DMModalProvider>
              {shouldHideLayout ? (
                // 법적 문서 페이지에서 인증 페이지에서 온 경우: 헤더/사이드바 숨김
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
                  <div className="flex">
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
        </ThemeProvider>
      </body>
    </html>
  );
}