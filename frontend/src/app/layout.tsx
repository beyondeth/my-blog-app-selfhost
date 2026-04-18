import type { Metadata } from 'next';
import Script from 'next/script';
import "./globals.css";
import '@/editor/styles/editor.css';  // 전역 로드 - 포스트 페이지 CSS preload 경고 해결
import LayoutClient from './layout-client';
import { SocketProvider } from '@/providers/SocketProvider';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

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
    default: 'Codebase - AI 트렌드 & 바이브코딩 커뮤니티',
    template: '%s | Codebase',
  },
  description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
  keywords: ['AI 커뮤니티', 'AI 트렌드', '바이브코딩', 'LLM', '프롬프트', '에이전트', 'AI 도구', '개발 커뮤니티'],
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
    title: 'Codebase - AI 트렌드 & 바이브코딩 커뮤니티',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
    siteName: 'Codebase',
    images: [
      {
        url: '/og-image-v2.png',
        width: 1200,
        height: 630,
        alt: '블로그 자동포스팅',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codebase - AI 트렌드 & 바이브코딩 커뮤니티',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
    images: ['/og-image-v2.png'],
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
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,slnt,wdth,wght,ROND@8..144,-10..0,25..150,400..600,0..100&family=Google+Sans+Code:ital,wght@0,400;0,500;1,400&display=swap"
          as="style"
        />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,slnt,wdth,wght,ROND@8..144,-10..0,25..150,400..600,0..100&family=Google+Sans+Code:ital,wght@0,400;0,500;1,400&display=swap"
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
