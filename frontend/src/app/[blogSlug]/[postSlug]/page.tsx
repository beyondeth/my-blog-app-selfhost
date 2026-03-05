import { Metadata } from 'next';
import { cache } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import BlogPostDetailClient from './client-page';
import { notFound } from 'next/navigation';

// 포스트 데이터 타입 정의 (백엔드 실제 구조 반영)
interface Post {
  id: string;
  title: string;
  content: string;
  excerpt?: string;           // 백엔드에서 제공하는 요약 (200자)
  slug: string;
  thumbnail?: string | null;  // 썸네일 이미지 URL
  visibility?: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  tagList?: string[];         // 백엔드 실제 필드명
  tags?: string[];            // tagList 별칭 (호환성)
  author?: {
    id: string;
    username: string;
    profileImage?: string | null;
    bio?: string | null;
    role?: string;
  };
  blog: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    isPublic?: boolean;
    allowComments?: boolean;
    userId?: string;
  };
}

/** 비공개 블로그임을 나타내는 sentinel 타입 */
interface PrivateBlogSentinel {
  __isPrivateBlog: true;
}

// 포스트 데이터 가져오기 (서버 컴포넌트용)
// cache로 감싸서 동일한 렌더링 사이클 내 중복 호출 방지
const getPost = cache(
  async (
    blogSlug: string,
    postSlug: string,
    options?: { fresh?: boolean },
  ): Promise<Post | PrivateBlogSentinel | null> => {

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const requestPath = options?.fresh
      ? `${apiUrl}/posts/slug/${postSlug}?fresh=1`
      : `${apiUrl}/posts/slug/${postSlug}`;

    // SSR 환경에서 인증 쿠키를 백엔드로 포워딩
    // 비공개 블로그 소유자가 자신의 글을 볼 수 있도록 쿠키 전달
    let cookieHeader: string | undefined;
    try {
      const cookieStore = await cookies();
      cookieHeader = cookieStore.toString();
    } catch {
      // 클라이언트 사이드나 쿠키 접근 불가한 경우 무시
    }

    const response = await fetch(
      requestPath,
      {
        // 수정 직후 상세 페이지 stale 노출 방지를 위해 항상 최신 데이터를 가져온다.
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // 비공개 블로그 포스트인 경우 블로그 비공개 플래그로 구분
        // 백엔드에서 비공개 블로그 포스트는 NotFoundException(404)로 응답
        // 블로그 자체를 조회해서 비공개 여부 확인
        try {
          const apiUrl2 = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
          const blogRes = await fetch(`${apiUrl2}/blogs/slug/${blogSlug}`, {
            cache: 'no-store',
            headers: {
              'Content-Type': 'application/json',
              ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
            },
          });
          if (blogRes.ok) {
            const blogData = await blogRes.json();
            if (blogData.isPrivate) {
              return { __isPrivateBlog: true };
            }
          }
        } catch {
          // 블로그 확인 실패 시 무시
        }
        return null;
      }
      if (response.status === 403) {
        return null;
      }
      throw new Error('Failed to fetch post');
    }

    const data = await response.json();
    // API가 직접 포스트 객체를 반환
    return data;
  } catch (error) {
    // 에러 발생 시 기본 메타데이터 반환 (페이지 로드 방지)
    console.error('Error fetching post for metadata:', error);
    return null;
  }
  },
);

// 동적 메타데이터 생성 함수
export async function generateMetadata(
  { params }: { params: Promise<{ blogSlug: string; postSlug: string }> }
): Promise<Metadata> {
  // Next.js 16: params는 Promise
  const { blogSlug, postSlug } = await params;
  const post = await getPost(blogSlug, postSlug);

  if (!post) {
    return {
      title: '포스트를 찾을 수 없습니다',
      description: '요청하신 포스트를 찾을 수 없습니다.',
    };
  }

  // 비공개 블로그 포스트인 경우 (SEO 노출 차단)
  if ('__isPrivateBlog' in post) {
    return {
      title: '비공개 포스트',
      description: '비공개 블로그의 포스트입니다.',
      robots: { index: false, follow: false },
    };
  }

  if (post.visibility === 'private') {
    return {
      title: `${post.title} | ${post.blog.name}`,
      description: '비공개 포스트입니다.',
      robots: { index: false, follow: false },
    };
  }

  // 포스트 요약문 생성 (excerpt 우선, 없으면 content에서 추출)
  const description = post.excerpt ||
                      post.content
                        ?.replace(/<[^>]*>/g, '') // HTML 태그 제거
                        .replace(/\n+/g, ' ') // 줄바꿈 공백 변환
                        .trim()
                        .substring(0, 160) || // 160자로 제한
                      '블로그 포스트';

  // 사이트 정보 (환경변수에서 가져오기)
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  // 포스트 전체 URL
  const postUrl = `${siteUrl}/${blogSlug}/${postSlug}`;

  // 썸네일 이미지 URL (절대 경로로 변환)
  const ogImage = post.thumbnail
    ? (post.thumbnail.startsWith('http')
        ? post.thumbnail
        : `${siteUrl}${post.thumbnail}`)
    : `${siteUrl}/assets/block-logo(dark)-128.png`; // 기본 OG 이미지

  // 저자 정보
  const authorName = post.author?.username || post.blog?.name || 'Unknown Author';

  return {
    // 기본 메타 태그
    title: `${post.title} | ${post.blog.name}`,
    description,

    // 키워드 (태그가 있으면 사용)
    keywords: (post.tagList || post.tags)?.length ? (post.tagList || post.tags)!.join(', ') : undefined,

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
      tags: post.tagList || post.tags,
    },

    // Twitter 카드 메타 태그
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description,
      images: [ogImage],
      creator: `@${post.author?.username || post.blog?.slug}`,
    },

    // 기타 메타 태그
    authors: [{ name: authorName }],
    generator: 'Next.js',
    applicationName: siteName,
    referrer: 'origin-when-cross-origin',

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

// JSON-LD 구조화된 데이터 생성 함수
function generateStructuredData(post: Post, params: { blogSlug: string; postSlug: string }) {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const postUrl = `${siteUrl}/${params.blogSlug}/${params.postSlug}`;

  // 썸네일 이미지 URL (절대 경로로 변환)
  const imageUrl = post.thumbnail
    ? (post.thumbnail.startsWith('http')
        ? post.thumbnail
        : `${siteUrl}${post.thumbnail}`)
    : undefined;

  // Article 구조화된 데이터
  const articleData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.content?.replace(/<[^>]*>/g, '').substring(0, 160),
    url: postUrl,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author?.username || post.blog?.name || 'Unknown Author',
      url: `${siteUrl}/${params.blogSlug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: siteName,
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/assets/logo.svg`,
        width: 600,
        height: 60,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    ...(imageUrl && {
      image: {
        '@type': 'ImageObject',
        url: imageUrl,
        width: 1200,
        height: 630,
      },
    }),
    ...((post.tagList || post.tags) && (post.tagList || post.tags)!.length > 0 && {
      keywords: (post.tagList || post.tags)!.join(', '),
    }),
    interactionStatistic: [
      {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ReadAction',
        userInteractionCount: post.viewCount || 0,
      },
    ],
  };

  // BreadcrumbList 구조화된 데이터
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
        name: post.blog.name,
        item: `${siteUrl}/${params.blogSlug}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: postUrl,
      },
    ],
  };

  return [articleData, breadcrumbData];
}

// 서버 컴포넌트 페이지
export default async function BlogPostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ blogSlug: string; postSlug: string }>;
  searchParams: Promise<{ fresh?: string; t?: string }>;
}) {
  // Next.js 16: params는 Promise
  const { blogSlug, postSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const forceFresh =
    resolvedSearchParams.fresh === '1' ||
    resolvedSearchParams.fresh === 'true';

  // 포스트 데이터 미리 가져오기 (404 체크용)
  const post = await getPost(blogSlug, postSlug, { fresh: forceFresh });

  // 비공개 블로그 접근 시 전용 안내 페이지
  if (post && '__isPrivateBlog' in post) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-6">
          <svg
            className="w-10 h-10 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          비공개 블로그입니다
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-sm">
          이 블로그는 비공개 상태입니다. 블로그 소유자만 볼 수 있습니다.
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-lg bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  // 포스트가 없으면 404 페이지로
  if (!post) {
    notFound();
  }

  // JSON-LD 구조화된 데이터 생성
  // (post는 위에서 !post와 __isPrivateBlog 체크를 통과했으므로 항상 Post 타입임)
  const structuredData = generateStructuredData(post as Post, { blogSlug, postSlug });

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

      {/* 클라이언트 컴포넌트 렌더링 - 서버 데이터 전달 */}
      <BlogPostDetailClient initialPost={post} />
    </>
  );
}
