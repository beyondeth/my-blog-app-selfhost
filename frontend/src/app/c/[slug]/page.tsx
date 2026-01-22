import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import CommunityDetailClient from './client-page';
import type { Community } from '@/types/community';

// 중복 API 호출 방지를 위한 React Cache 적용
const getCommunity = cache(async (slug: string): Promise<Community | null> => {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    // fetch URL: /community/:slug
    const res = await fetch(`${apiUrl}/community/${slug}`, {
      next: { revalidate: 60 }, // 1분 캐시 (ISR)
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      // 403 Forbidden (초대 전용 등)일 때도 null로 처리하거나 별도 처리 가능
      // 여기서는 일단 null 반환 후 클라이언트에서 에러 처리 위임 혹은 404
      return null;
    }

    const json = await res.json();
    return json.success ? json.data : null;
  } catch (error) {
    console.error('Failed to fetch community:', error);
    return null;
  }
});

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const community = await getCommunity(slug);

  if (!community) {
    return {
      title: '커뮤니티를 찾을 수 없습니다',
      description: '요청하신 커뮤니티를 찾을 수 없습니다.',
    };
  }

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const communityUrl = `${siteUrl}/c/${slug}`;
  const description = community.description || `${community.name} 커뮤니티입니다.`;

  // 대표 이미지 (아이콘이 없으면 기본 이미지)
  const imageUrl = community.iconUrl || `${siteUrl}/og-image-v2.png`;

  return {
    title: `${community.name} | ${siteName}`,
    description: description,
    openGraph: {
      type: 'website',
      title: community.name,
      description: description,
      url: communityUrl,
      siteName: siteName,
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: community.name,
        },
      ],
    },
    twitter: {
      card: 'summary',
      title: community.name,
      description: description,
      images: [imageUrl],
    },
  };
}

export default async function CommunityPage({ params }: PageProps) {
  const { slug } = await params;
  const community = await getCommunity(slug);

  if (!community) {
    notFound();
  }

  // JSON-LD 구조화된 데이터 생성
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: community.name,
    description: community.description || `${community.name} 커뮤니티 메인`,
    url: `${siteUrl}/c/${slug}`,
    image: community.iconUrl || `${siteUrl}/og-image-v2.png`,
    mainEntity: {
      '@type': 'Organization',
      name: community.name,
      description: community.description,
      url: `${siteUrl}/c/${slug}`,
    },
    memberCount: community.memberCount,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <CommunityDetailClient initialCommunity={community} slug={slug} />
    </>
  );
}
