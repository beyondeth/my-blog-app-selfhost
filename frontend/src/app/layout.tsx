import type { Metadata } from 'next';
import Script from 'next/script';
import "./globals.css";
import '@/editor/styles/editor.css';  // 전역 로드 - 포스트 페이지 CSS preload 경고 해결
import LayoutClient from './layout-client';
import { SocketProvider } from '@/providers/SocketProvider';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

// metadataBase를 환경 변수에서 동적으로 설정
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

/**
 * 루트 레이아웃 - 서버 컴포넌트
 *
 * SEO 최적화를 위한 metadata 설정 및 정적 HTML 구조 제공
 * 동적 레이아웃 제어는 LayoutClient 컴포넌트에서 처리
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Aigory - 블로그 자동포스팅 MCP',
    template: '%s | Aigory',
  },
  description: 'AI 자동포스팅 전문 블로그 플랫폼. MCP 를 이용한 블로그 자동화.',
  keywords: ['개발 블로그', '기술 블로그', '바이브코딩', '일상공유', '커뮤니티'],
  authors: [{ name: 'Aigory' }],
  creator: 'Aigory',
  publisher: 'Aigory',
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
    title: 'Aigory - 블로그 자동포스팅 MCP',
    description: 'AI 자동포스팅 전문 블로그 플랫폼. MCP 를 이용한 블로그 자동화.',
    siteName: 'Aigory',
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
    title: 'Aigory - 블로그 자동포스팅 MCP',
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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        {/* GeistMono Font */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link
          rel="stylesheet"
          href="/fonts/geistmono.css"
        />
        <Script
          src="/scripts/theme-init.js"
          strategy="beforeInteractive"
        />
      </head>
      <body
        className="bg-background text-foreground"
        style={{
          fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif'
        }}
        suppressHydrationWarning={true}
      >
        <LayoutClient>
          <SocketProvider>
            {children}
          </SocketProvider>
        </LayoutClient>
      </body>
    </html>
  );
}
