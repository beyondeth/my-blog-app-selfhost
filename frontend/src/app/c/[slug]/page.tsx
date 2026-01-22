import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import CommunityDetailClient from './client-page';
import type { Community } from '@/types/community';

async function getAuthCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const readCookieValue = (name: string): string | undefined => {
    if (cookieStore && typeof (cookieStore as { get?: (key: string) => { value?: string } | undefined }).get === 'function') {
      return (cookieStore as { get: (key: string) => { value?: string } | undefined })
        .get(name)
        ?.value;
    }
    if (cookieStore && typeof (cookieStore as { getAll?: () => Array<{ name: string; value: string }> }).getAll === 'function') {
      const allCookies = (cookieStore as { getAll: () => Array<{ name: string; value: string }> }).getAll();
      return allCookies.find((cookie) => cookie.name === name)?.value;
    }
    if (cookieStore && typeof (cookieStore as { toString?: () => string }).toString === 'function') {
      const cookieString = (cookieStore as { toString: () => string }).toString();
      return cookieString
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`))
        ?.slice(name.length + 1);
    }
    return undefined;
  };
  const accessToken = readCookieValue('access_token');

  // 보안: access_token만 전달 (refresh_token은 클라이언트 → 백엔드 /auth/refresh 전용)
  return accessToken ? `access_token=${accessToken}` : undefined;
}


async function fetchCommunity(
  slug: string,
  cookieHeader?: string,
): Promise<Community | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const hasCookie = Boolean(cookieHeader);
    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {};
    if (hasCookie) {
      fetchOptions.cache = 'no-store';
      fetchOptions.headers = { cookie: cookieHeader! };
    } else {
      fetchOptions.next = { revalidate: 60 };
    }

    // fetch URL: /community/:slug
    const res = await fetch(`${apiUrl}/community/${slug}`, fetchOptions);

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
}

// 중복 API 호출 방지를 위한 React Cache 적용 (익명 조회 전용)
const getCommunityPublic = cache(async (slug: string): Promise<Community | null> =>
  fetchCommunity(slug)
);

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cookieHeader = await getAuthCookieHeader();
  const community = cookieHeader
    ? await fetchCommunity(slug, cookieHeader)
    : await getCommunityPublic(slug);

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
  const cookieHeader = await getAuthCookieHeader();
  const community = cookieHeader
    ? await fetchCommunity(slug, cookieHeader)
    : await getCommunityPublic(slug);

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
