import { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: 'AI 코딩 학습 커뮤니티와 creator 지식 허브 - Codebase',
  description:
    'Codebase는 AI 코딩 입문자와 creator를 위한 학습 허브입니다. 유튜브 영상, 질문, 가이드를 Start Here와 FAQ 아카이브로 구조화합니다.',
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
    title: 'AI 코딩 학습 커뮤니티와 creator 지식 허브 - Codebase',
    description:
      '유튜브와 커뮤니티에 흩어진 AI 코딩 지식을 더 쉽게 배우고 다시 찾을 수 있게 구조화한 Codebase를 만나보세요.',
    url: `${siteUrl}/landing`,
    siteName: 'Codebase',
    images: [
      {
        url: `${siteUrl}/og-image-v2.png`,
        width: 1200,
        height: 630,
        alt: 'Codebase landing page',
      },
    ],
    locale: 'ko_KR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI 코딩 학습 커뮤니티와 creator 지식 허브 - Codebase',
    description:
      'AI 코딩 입문자와 creator를 위한 Start Here, Companion Page, Solved Q&A 구조를 경험해보세요.',
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
