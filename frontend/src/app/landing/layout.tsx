import type { Metadata } from 'next';
import { getRequestLocale } from '@/lib/i18n/server';

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001').replace(/\/+$/, '');

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const isKorean = locale === 'ko';
  const title = isKorean
    ? 'Aigory 오픈소스 블로그·MCP 자동포스팅 플랫폼'
    : 'Aigory open-source blog and MCP publishing platform';
  const description = isKorean
    ? '블로그, MCP 자동포스팅, 커뮤니티를 하나의 MIT 오픈소스 기반에서 운영하고 커스터마이징하세요.'
    : 'Run and customize blogs, MCP auto-publishing, and communities on one MIT-licensed open-source foundation.';
  const canonical = `${siteUrl}/${locale}/landing`;
  const image = `${siteUrl}/og-image-v2.png`;

  return {
    title,
    description,
    keywords: isKorean
      ? ['오픈소스 블로그', 'MCP 자동포스팅', '셀프호스트', '커뮤니티', 'Aigory']
      : ['open-source blog', 'MCP publishing', 'self-hosted', 'community', 'Aigory'],
    alternates: {
      canonical,
      languages: {
        en: `${siteUrl}/en/landing`,
        ko: `${siteUrl}/ko/landing`,
      },
    },
    openGraph: {
      type: 'website',
      locale: isKorean ? 'ko_KR' : 'en_US',
      url: canonical,
      title,
      description,
      siteName: 'Aigory',
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: { index: true, follow: true },
  };
}

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
