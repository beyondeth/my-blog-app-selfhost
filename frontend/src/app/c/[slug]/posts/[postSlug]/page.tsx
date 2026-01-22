import { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import PostDetailClient from './client-page';
import type { CommunityPost } from '@/types/community';

/**
 * 커뮤니티 게시물 데이터 가져오기 (Server Component)
 * - cache로 감싸서 generateMetadata와 Page 컴포넌트 간 중복 호출 방지
 */
const getPost = cache(async (slug: string, postSlug: string): Promise<CommunityPost | null> => {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    
    // OptionalJwtAuthGuard가 적용된 엔드포인트 호출
    // 쿠키를 전달하지 않아도 공개 게시물은 조회 가능해야 함
    const response = await fetch(
      `${apiUrl}/community/${slug}/posts/${postSlug}`,
      {
        next: { revalidate: 60 }, // 60초 캐싱 (ISR)
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      // 403 Forbidden (비공개 커뮤니티 등)일 경우에도 null 반환하여
      // Client Component에서 Auth 처리하도록 유도할 수도 있으나,
      // 여기서는 null 반환 -> 404 or Client Side fallback
      return null;
    }

    const json = await response.json();
    return json.data; // ResponseWrapper { success: true, data: ... }
  } catch (error) {
    console.error('Failed to fetch community post:', error);
    return null;
  }
});

/**
 * 동적 메타데이터 생성 (SEO)
 */
export async function generateMetadata(
  { params }: { params: Promise<{ slug: string; postSlug: string }> }
): Promise<Metadata> {
  const { slug, postSlug } = await params;
  const post = await getPost(slug, postSlug);

  if (!post) {
    return {
      title: '게시물을 찾을 수 없습니다',
      description: '요청하신 게시물을 찾을 수 없습니다.',
    };
  }

  // 요약문 생성 (content에서 추출)
  const description = post.content
    .replace(/<[^>]*>/g, '') // HTML 태그 제거
    .replace(/\n+/g, ' ')    // 줄바꿈 공백 변환
    .trim()
    .substring(0, 160) ||    // 160자 제한
    '커뮤니티 게시물';

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const postUrl = `${siteUrl}/c/${slug}/posts/${postSlug}`;

  // 썸네일/이미지 추출 (본문 내 첫 번째 이미지 or 기본 이미지)
  // Markdown/HTML에서 이미지 추출하는 로직은 복잡하므로 여기서는
  // post.images[] 같은 필드가 있다면 활용하겠지만, 현재는 없으므로 기본 로직 사용
  // 실제 확장이 필요하면 백엔드에서 thumbnail 필드를 내려주는 것이 좋음.
  const ogImage = `${siteUrl}/assets/logo.svg`; // 기본 이미지

  return {
    title: `${post.title} : c/${slug}`,
    description,
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
      publishedTime: post.createdAt,
      modifiedTime: post.updatedAt,
      section: slug, // 커뮤니티 명을 섹션으로
      authors: [post.author?.username || 'Unknown'],
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * JSON-LD 구조화된 데이터 생성
 */
function generateStructuredData(post: CommunityPost, slug: string, postSlug: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const postUrl = `${siteUrl}/c/${slug}/posts/${postSlug}`;

  return {
    '@context': 'https://schema.org',
    '@type': 'DiscussionForumPosting',
    headline: post.title,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author?.username || 'Unknown',
      url: `${siteUrl}/${post.author?.username || ''}`, // 유저 프로필 가정
    },
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/LikeAction',
        userInteractionCount: post.likeCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/CommentAction',
        userInteractionCount: post.commentCount,
      },
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: post.viewCount,
      },
    ],
    publisher: {
      '@type': 'Organization',
      name: 'Codebase Community',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/assets/logo.svg`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
  };
}

/**
 * 커뮤니티 게시물 상세 페이지 (Server Component)
 */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; postSlug: string }>;
}) {
  const { slug, postSlug } = await params;
  const post = await getPost(slug, postSlug);

  // SEO를 위해 데이터가 있으면 JSON-LD 주입
  const structuredData = post ? generateStructuredData(post, slug, postSlug) : null;

  return (
    <>
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
      <PostDetailClient initialPost={post} params={params} />
    </>
  );
}
