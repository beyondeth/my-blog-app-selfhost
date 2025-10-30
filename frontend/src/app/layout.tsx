import type { Metadata } from 'next';
import "./globals.css";
import LayoutClient from './layout-client';

// metadataBase를 환경 변수에서 동적으로 설정
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

/**
 * 루트 레이아웃 - 서버 컴포넌트
 *
 * SEO 최적화를 위한 metadata 설정 및 정적 HTML 구조 제공
 * 동적 레이아웃 제어는 LayoutClient 컴포넌트에서 처리
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Codebase - 블로그 자동포스팅 MCP',
    template: '%s | Codebase',
  },
  description: 'AI 자동포스팅 전문 블로그 플랫폼. MCP 를 이용한 블로그 자동화.',
  keywords: ['개발 블로그', '기술 블로그', '바이브코딩', '일상공유', '커뮤니티'],
  authors: [{ name: 'Codebase' }],
  creator: 'Codebase',
  publisher: 'Codebase',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: siteUrl,
    title: 'Codebase - 블로그 자동포스팅 MCP',
    description: 'AI 자동포스팅 전문 블로그 플랫폼. MCP 를 이용한 블로그 자동화.',
    siteName: 'Codebase',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: '블로그 자동포스팅',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codebase - 블로그 자동포스팅 MCP',
    description: 'AI 자동포스팅 전문 블로그 플랫폼. MCP 를 이용한 블로그 자동화.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
        <LayoutClient>{children}</LayoutClient>
      </body>
    </html>
  );
}
