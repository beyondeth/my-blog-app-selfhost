import type { Metadata } from 'next';
import LandingClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Codebase - AI 트렌드 & 바이브코딩 커뮤니티',
  description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
  openGraph: {
    type: 'website',
    title: 'Codebase - AI 트렌드 & 바이브코딩 커뮤니티',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
    images: [
      {
        url: '/og-image-v2.png',
        width: 1200,
        height: 630,
        alt: 'Codebase Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codebase - AI 트렌드 & 바이브코딩 커뮤니티',
    description: 'LLM, 프롬프트, 에이전트, AI 도구의 최신 트렌드를 나누고 초보자도 쉽게 시작할 수 있는 바이브코딩 커뮤니티.',
    images: ['/og-image-v2.png'],
  },
};

export default function LandingPage() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Codebase',
    url: siteUrl,
    description: 'AI 트렌드와 바이브코딩 정보를 나누는 커뮤니티 플랫폼',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Codebase',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingClientPage />
    </>
  );
}
