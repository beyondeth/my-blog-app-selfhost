import { Metadata } from 'next';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import CommunityPostDetailClient from './client-page';
import type { CommunityPost } from '@/types/community';
import { serializeJsonLd } from '@/lib/security/json-ld';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 인증 쿠키 헤더 생성 (access_token만 전달)
 */
async function getAuthCookieHeader(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get?.('access_token')?.value;
  return accessToken ? `access_token=${accessToken}` : undefined;
}

/**
 * 커뮤니티 게시물 데이터 가져오기 (서버 컴포넌트용)
 *
 * @description
 * - 인증된 요청: 비공개 커뮤니티 멤버/오너도 접근 가능
 * - 비인증 요청: 공개 게시물만 조회 (캐시 사용)
 * - 403 에러(private 커뮤니티)는 undefined 반환 (클라이언트에서 재시도)
 */
async function fetchCommunityPost(
  communitySlug: string,
  postId: string,
  cookieHeader?: string,
): Promise<CommunityPost | null | undefined> {
  try {
    const hasCookie = Boolean(cookieHeader);
    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
      headers: { 'Content-Type': 'application/json' },
    };

    if (hasCookie) {
      fetchOptions.cache = 'no-store';
      (fetchOptions.headers as Record<string, string>).cookie = cookieHeader!;
    } else {
      fetchOptions.next = { revalidate: 60 };
    }

    const response = await fetch(
      `${API_URL}/community/${communitySlug}/comments/${postId}`,
      fetchOptions
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      // 403 (private 커뮤니티): undefined 반환 → 클라이언트에서 인증 포함 재시도
      if (response.status === 403) return undefined;
      throw new Error('Failed to fetch community post');
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('Error fetching community post for metadata:', error);
    return null;
  }
}

// 중복 API 호출 방지를 위한 React Cache 적용 (익명 조회 전용)
const getCommunityPostPublic = cache(async (
  communitySlug: string,
  postId: string
): Promise<CommunityPost | null | undefined> =>
  fetchCommunityPost(communitySlug, postId)
);

/**
 * 동적 메타데이터 생성 (SEO)
 *
 * @description
 * - Open Graph: 소셜 미디어 공유용
 * - Twitter Card: 트위터 공유용
 * - 캐노니컬 URL: 검색 엔진 최적화
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; postId: string }> }
): Promise<Metadata> {
  const { slug, postId } = await params;
  const cookieHeader = await getAuthCookieHeader();
  const post = cookieHeader
    ? await fetchCommunityPost(slug, postId, cookieHeader)
    : await getCommunityPostPublic(slug, postId);

  if (!post) {
    return {
      title: 'Post not found',
      description: 'The requested post could not be found.',
    };
  }

  // 게시물 요약문 생성
  const description = post.content
    ?.replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 160) || 'Community post';

  // 사이트 정보
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Aigory';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  // 게시물 전체 URL (Reddit 스타일)
  const postUrl = `${siteUrl}/c/${slug}/comments/${postId}`;

  const preferredThumbnail = post.thumbnailImageUrl || post.thumbnailUrl || null;
  const toAbsoluteUrl = (url: string) => (url.startsWith('http') ? url : `${siteUrl}${url}`);
  const ogImage = preferredThumbnail
    ? toAbsoluteUrl(preferredThumbnail)
    : `${siteUrl}/assets/block-logo(dark)-128.png`;

  // 저자 정보
  const authorName = post.author?.username || 'Unknown';

  // 커뮤니티 이름
  const communityName = post.community?.name || `c/${slug}`;

  return {
    // 기본 메타 태그
    title: `${post.title} - ${communityName}`,
    description,

    // 키워드 (태그)
    keywords: post.tags?.length ? post.tags.join(', ') : undefined,

    // Open Graph 메타 태그
    openGraph: {
      type: 'article',
      title: post.title,
      description,
      url: postUrl,
      siteName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      authors: [authorName],
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      tags: post.tags,
    },

    // Twitter 카드 메타 태그
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImage],
    },

    // 기타 메타 태그
    authors: [{ name: authorName }],
    generator: 'Next.js',
    applicationName: siteName,

    // 캐노니컬 URL
    alternates: {
      canonical: postUrl,
    },

    // 로봇 메타 태그
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

/**
 * JSON-LD 구조화된 데이터 생성
 *
 * @description
 * - DiscussionForumPosting: Reddit 스타일 토론 게시물
 * - BreadcrumbList: 네비게이션 경로
 * - 검색 엔진이 콘텐츠 구조를 이해하도록 지원
 */
function generateStructuredData(
  post: CommunityPost,
  params: { slug: string; postId: string }
) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Aigory';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const postUrl = `${siteUrl}/c/${params.slug}/comments/${params.postId}`;
  const makeAbsolute = (url: string) => (url.startsWith('http') ? url : `${siteUrl}${url}`);

  // 썸네일 이미지 URL
  const preferredStructuredImage = post.thumbnailImageUrl || post.thumbnailUrl;
  const imageUrl = preferredStructuredImage ? makeAbsolute(preferredStructuredImage) : undefined;

  // DiscussionForumPosting 구조화된 데이터 (Reddit 스타일)
  const discussionData = {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: post.title,
    text: post.content?.replace(/<[^>]*>/g, '').substring(0, 500),
    url: postUrl,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author?.username || 'Unknown',
      url: `${siteUrl}/${post.author?.username}`,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
    },
    discussionUrl: postUrl,
    ...(imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: imageUrl,
      },
    }),
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: post.commentCount || 0,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: post.upvoteCount || 0,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ReadAction',
        userInteractionCount: post.viewCount || 0,
      },
    ],
  };

  // BreadcrumbList 구조화된 데이터
  const communityName = post.community?.name || `c/${params.slug}`;
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Communities',
        item: `${siteUrl}/c`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: communityName,
        item: `${siteUrl}/c/${params.slug}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: post.title,
        item: postUrl,
      },
    ],
  };

  return [discussionData, breadcrumbData];
}

/**
 * 커뮤니티 게시물 상세 페이지 (서버 컴포넌트)
 *
 * @description
 * - Reddit 스타일 URL: /c/{slug}/comments/{postId}
 * - SEO 최적화: generateMetadata + JSON-LD
 * - 클라이언트 컴포넌트 분리로 하이드레이션 최적화
 * - private 커뮤니티(403)는 클라이언트에서 인증 포함 재시도
 */
export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;

  // 게시물 데이터 가져오기 (인증된 사용자는 비공개 커뮤니티도 접근 가능)
  const cookieHeader = await getAuthCookieHeader();
  const post = cookieHeader
    ? await fetchCommunityPost(slug, postId, cookieHeader)
    : await getCommunityPostPublic(slug, postId);

  // 게시물이 없으면 404 (null = 진짜 없음)
  if (post === null) {
    notFound();
  }

  // undefined = 403 (private 커뮤니티) → 클라이언트에서 인증 포함 재시도
  if (post === undefined) {
    return (
      <CommunityPostDetailClient
        communitySlug={slug}
        postSlug={postId}
      />
    );
  }

  // JSON-LD 구조화된 데이터 생성
  const structuredData = generateStructuredData(post, { slug, postId });

  return (
    <>
      {/* JSON-LD 구조화된 데이터 삽입 */}
      {structuredData.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: serializeJsonLd(data),
          }}
        />
      ))}

      {/* 클라이언트 컴포넌트 렌더링 */}
      <CommunityPostDetailClient
        communitySlug={slug}
        postSlug={postId}
        initialPost={post}
      />
    </>
  );
}
