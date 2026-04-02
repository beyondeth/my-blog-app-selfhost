import type { Metadata } from 'next';
import LandingClientPage from './client-page';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'AI 코딩 학습 커뮤니티와 creator 지식 허브 - Codebase',
  description:
    'Codebase는 AI 코딩 입문자와 creator를 위한 학습 허브입니다. Start Here, Companion Page, Solved Q&A 구조로 배우고 다시 찾는 경험을 만듭니다.',
  openGraph: {
    type: 'website',
    title: 'AI 코딩 학습 커뮤니티와 creator 지식 허브 - Codebase',
    description:
      '유튜브와 커뮤니티에 흩어진 AI 코딩 지식을 더 쉽게 배우고 다시 찾을 수 있게 구조화한 Codebase를 만나보세요.',
    url: `${siteUrl}/landing`,
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'Codebase Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 코딩 학습 커뮤니티와 creator 지식 허브 - Codebase',
    description:
      'Start Here, Companion Page, Solved Q&A 구조로 배우고 다시 찾는 AI 코딩 학습 허브.',
    images: [`${siteUrl}/og-image-v2.png`],
  },
};

export default function LandingPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Codebase',
    url: siteUrl,
    description: 'AI 코딩 학습 커뮤니티와 creator 지식 허브',
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <LandingClientPage />
    </>
  );
}
