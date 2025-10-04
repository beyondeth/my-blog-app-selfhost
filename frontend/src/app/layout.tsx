import type { Metadata } from "next";
import "./globals.css";
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import ClientProviders from '@/components/ClientProviders';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from 'sonner';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { DMModalProvider } from '@/components/dm/DMModalProvider';

export const metadata: Metadata = {
  title: "My Blog",
  description: "개인 블로그입니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
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
              {/* 유튜브 스타일 레이아웃: 상단 헤더 + 왼쪽 사이드바 + 메인 콘텐츠 */}
              <div>
                <Header />
                <div className="flex">
                  <LeftSidebar />
                  {/* 왼쪽 사이드바 영역 확보: translate-x-[23px] + w-20 = 103px, 여유 25px 포함 = 128px */}
                  <div className="flex-1 lg:ml-32">
                    {children}
                  </div>
                </div>
              </div>
              <Toaster position="top-center" richColors />
              <PerformanceMonitor />
            </DMModalProvider>
          </ClientProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
