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

    const res = await fetch(`${apiUrl}/community/${slug}`, fetchOptions);

    if (!res.ok) {
      if (res.status === 404) return null;
      return null;
    }

    const json = await res.json();
    return json.success ? json.data : null;
  } catch (error) {
    console.error('Failed to fetch community:', error);
    return null;
  }
}

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
      title: 'Community not found',
      description: 'The community you requested could not be found.',
    };
  }

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const communityUrl = `${siteUrl}/c/${slug}`;
  const description =
    community.description ||
    `Join ${community.name} to discuss AI trends, workflows, and practical building techniques.`;

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

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: community.name,
    description:
      community.description ||
      `Main page for the ${community.name} community.`,
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
