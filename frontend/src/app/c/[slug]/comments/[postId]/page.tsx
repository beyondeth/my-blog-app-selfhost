import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import CommunityPostDetailClient from './client-page';
import type { CommunityPost } from '@/types/community';

/**
 * 커뮤니티 게시물 데이터 가져오기 (서버 컴포넌트용)
 *
 * @description
 * - cache로 감싸서 동일한 렌더링 사이클 내 중복 호출 방지
 * - SEO 메타데이터와 페이지 렌더링에서 동시 사용
 * - 403 에러(private 커뮤니티)는 undefined 반환 (클라이언트에서 재시도)
 */
const getCommunityPost = cache(async (
  communitySlug: string,
  postId: string
): Promise<CommunityPost | null | undefined> => {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

    // 새로운 /comments/ 엔드포인트 사용 (Reddit 스타일)
    const response = await fetch(
      `${apiUrl}/community/${communitySlug}/comments/${postId}`,
      {
        next: { revalidate: 60 }, // 60초마다 재검증
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      // 403 (private 커뮤니티): undefined 반환 → 클라이언트에서 인증 포함 재시도
      if (response.status === 403) {
        return undefined;
      }
      throw new Error('Failed to fetch community post');
    }

    const data = await response.json();
    return data.data || data;
  } catch (error) {
    console.error('Error fetching community post for metadata:', error);
    return null;
  }
});

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
  const post = await getCommunityPost(slug, postId);

  if (!post) {
    return {
      title: '게시물을 찾을 수 없습니다',
      description: '요청하신 게시물을 찾을 수 없습니다.',
    };
  }

  // 게시물 요약문 생성
  const description = post.content
    ?.replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 160) || '커뮤니티 게시물';

  // 사이트 정보
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  // 게시물 전체 URL (Reddit 스타일)
  const postUrl = `${siteUrl}/c/${slug}/comments/${postId}`;

  const preferredThumbnail = post.thumbnailImageUrl || post.thumbnailUrl || null;
  const toAbsoluteUrl = (url: string) => (url.startsWith('http') ? url : `${siteUrl}${url}`);
  const ogImage = preferredThumbnail
    ? toAbsoluteUrl(preferredThumbnail)
    : `${siteUrl}/assets/block-logo(dark)-128.png`;

  // 저자 정보
  const authorName = post.author?.username || '알 수 없음';

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
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
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
      name: post.author?.username || '알 수 없음',
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
        name: '홈',
        item: siteUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '커뮤니티',
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

  // 게시물 데이터 가져오기
  const post = await getCommunityPost(slug, postId);

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
            __html: JSON.stringify(data),
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

