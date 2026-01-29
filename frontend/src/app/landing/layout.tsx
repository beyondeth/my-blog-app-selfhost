import { Metadata } from 'next';

/**
 * Landing 페이지 메타데이터
 *
 * @description
 * MCP 자동포스팅 플랫폼 랜딩 페이지의 SEO 메타데이터를 설정합니다.
 * - 타이틀, 설명, Open Graph, Twitter Card
 * - Canonical URL 설정
 * - 전환율 최적화를 위한 메타데이터
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'AI 트렌드 & 바이브코딩 커뮤니티 - Codebase',
  description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
  keywords: ['AI 트렌드', '바이브코딩', 'LLM', '프롬프트', '에이전트', 'AI 도구', '커뮤니티', 'Codebase'],

  openGraph: {
    title: 'AI 트렌드 & 바이브코딩 커뮤니티 - Codebase',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
    url: `${siteUrl}/landing`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'Codebase MCP 자동 포스팅',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'AI 트렌드 & 바이브코딩 커뮤니티 - Codebase',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
    images: [`${siteUrl}/og-image-v2.png`],
  },

  alternates: {
    canonical: `${siteUrl}/landing`,
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
