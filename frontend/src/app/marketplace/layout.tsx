import type { Metadata } from 'next';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';

export const metadata: Metadata = {
  title: '마켓플레이스 - AI 지식 콘텐츠 거래 | Codebase',
  description:
    'AI 프롬프트, 코딩 템플릿, 기술 가이드를 거래하세요. 크리에이터가 만든 검증된 AI 지식 콘텐츠를 만나보세요.',
  openGraph: {
    title: '마켓플레이스 - AI 지식 콘텐츠 거래 | Codebase',
    description:
      'AI 프롬프트, 코딩 템플릿, 기술 가이드를 거래하세요.',
    url: `${siteUrl}/marketplace`,
  },
};

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
