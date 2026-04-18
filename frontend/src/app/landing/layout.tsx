import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'Codebase Product',
  description:
    'Codebase product 페이지로 이동합니다.',
  keywords: [
    'AI 코딩',
    '바이브코딩',
    'creator community',
    '학습 허브',
    'FAQ 아카이브',
    'video companion',
    'Codebase',
  ],
  openGraph: {
    title: 'Codebase Product',
    description:
      'Codebase의 공개 product surface와 documentation 구조를 확인할 수 있습니다.',
    url: `${siteUrl}/product`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'Codebase product page',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Codebase Product',
    description:
      'Codebase의 product, docs, pricing, support surface를 확인할 수 있습니다.',
    images: [`${siteUrl}/og-image-v2.png`],
  },
  alternates: {
    canonical: `${siteUrl}/product`,
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
