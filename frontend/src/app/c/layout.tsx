import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'AI 트렌드 & 바이브코딩 커뮤니티 디렉토리',
  description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드와 바이브코딩 정보를 나누는 커뮤니티 모음.',
  keywords: ['AI 커뮤니티', 'AI 트렌드', '바이브코딩', 'LLM', '프롬프트', '에이전트', 'AI 도구'],
  openGraph: {
    type: 'website',
    title: 'AI 트렌드 & 바이브코딩 커뮤니티 디렉토리',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드와 바이브코딩 정보를 나누는 커뮤니티 모음.',
    url: `${siteUrl}/c`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'AI 트렌드 & 바이브코딩 커뮤니티',
      },
    ],
    locale: 'ko_KR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 트렌드 & 바이브코딩 커뮤니티 디렉토리',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드와 바이브코딩 정보를 나누는 커뮤니티 모음.',
    images: [`${siteUrl}/og-image-v2.png`],
  },
  alternates: {
    canonical: `${siteUrl}/c`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
