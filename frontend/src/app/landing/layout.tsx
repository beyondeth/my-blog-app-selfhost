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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

export const metadata: Metadata = {
  title: 'MCP 자동 블로그 포스팅 - Codebase',
  description: '개발자를 위한 AI 자동 블로그 포스팅 플랫폼. MCP와 Claude를 활용하여 대화만으로 전문적인 기술 블로그를 자동으로 생성하고 발행하세요. 생산성 혁신을 경험하세요.',
  keywords: ['MCP', 'Claude', 'AI 블로그', '자동 포스팅', '개발 블로그 자동화', 'AI 글쓰기', 'Codebase'],

  openGraph: {
    title: 'MCP 자동 블로그 포스팅 - Codebase',
    description: '대화만으로 전문적인 기술 블로그를 자동으로 생성하고 발행하세요. AI와 MCP가 만나는 생산성 혁신.',
    url: `${siteUrl}/landing`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
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
    title: 'MCP 자동 블로그 포스팅 - Codebase',
    description: '대화만으로 전문적인 기술 블로그를 자동으로 생성하고 발행하세요.',
    images: [`${siteUrl}/og-image.png`],
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
