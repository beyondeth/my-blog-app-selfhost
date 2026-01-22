import type { Metadata } from 'next';
import LandingClientPage from './client-page';

export const metadata: Metadata = {
  title: 'Codebase - AI 자동포스팅 블로그 플랫폼',
  description: 'MCP 프로토콜 기반의 AI 자동포스팅으로 기술 블로그를 손쉽게 운영하세요. 개발자 커뮤니티와 지식 공유의 새로운 기준.',
  openGraph: {
    type: 'website',
    title: 'Codebase - AI 자동포스팅 블로그 플랫폼',
    description: 'MCP 프로토콜 기반의 AI 자동포스팅으로 기술 블로그를 손쉽게 운영하세요. 개발자 커뮤니티와 지식 공유의 새로운 기준.',
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
    title: 'Codebase - AI 자동포스팅 블로그 플랫폼',
    description: 'MCP 프로토콜 기반의 AI 자동포스팅으로 기술 블로그를 손쉽게 운영하세요.',
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
    description: 'AI 자동포스팅 전문 블로그 플랫폼',
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
