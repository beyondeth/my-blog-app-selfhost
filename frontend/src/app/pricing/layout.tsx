import { Metadata } from 'next';

/**
 * Pricing 페이지 메타데이터
 *
 * @description
 * 구독 요금제 페이지의 SEO 메타데이터를 설정합니다.
 * - 타이틀, 설명, Open Graph, Twitter Card
 * - Canonical URL 설정
 * - 구조화된 데이터 (JSON-LD) 포함
 */

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'Pricing - Codebase',
  description: 'Codebase 구독 요금제를 확인하세요. Free, Starter, Pro 플랜을 제공하며, 개발자를 위한 다양한 기능을 이용할 수 있습니다.',
  keywords: ['구독 요금제', 'pricing', '블로그 플랜', 'subscription', 'Codebase pricing'],

  openGraph: {
    title: 'Pricing - Codebase',
    description: 'Codebase 구독 요금제를 확인하세요. Free, Starter, Pro 플랜을 제공합니다.',
    url: `${siteUrl}/pricing`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Codebase Pricing',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'Pricing - Codebase',
    description: 'Codebase 구독 요금제를 확인하세요. Free, Starter, Pro 플랜을 제공합니다.',
    images: [`${siteUrl}/og-image.png`],
  },

  alternates: {
    canonical: `${siteUrl}/pricing`,
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
