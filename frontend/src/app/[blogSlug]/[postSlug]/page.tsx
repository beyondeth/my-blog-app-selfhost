import { Metadata } from 'next';
import BlogPostDetailClient from './client-page';
import { notFound } from 'next/navigation';

// 포스트 데이터 타입 정의
interface Post {
  id: string;
  title: string;
  content: string;
  excerpt?: string;
  summary?: string;
  slug: string;
  coverImage?: string | null;
  createdAt: string;
  updatedAt: string;
  viewCount?: number;
  readingTime?: string;
  tags?: string[];
  blog: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    user: {
      username: string;
      profileImage?: string | null;
    };
  };
}

// 포스트 데이터 가져오기 (서버 컴포넌트용)
async function getPost(blogSlug: string, postSlug: string): Promise<Post | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(
      `${apiUrl}/posts/slug/${postSlug}`,
      {
        // 서버 컴포넌트에서는 revalidate 옵션 사용
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
      throw new Error('Failed to fetch post');
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    console.error('Error fetching post for metadata:', error);
    return null;
  }
}

// 동적 메타데이터 생성 함수
export async function generateMetadata(
  { params }: { params: { blogSlug: string; postSlug: string } }
): Promise<Metadata> {
  const post = await getPost(params.blogSlug, params.postSlug);

  if (!post) {
    return {
      title: '포스트를 찾을 수 없습니다',
      description: '요청하신 포스트를 찾을 수 없습니다.',
    };
  }

  // 포스트 요약문 생성 (excerpt > summary > content 순서)
  const description = post.excerpt ||
                      post.summary ||
                      post.content
                        ?.replace(/<[^>]*>/g, '') // HTML 태그 제거
                        .replace(/\n+/g, ' ') // 줄바꿈 제거
                        .trim()
                        .substring(0, 160) || // 160자로 제한
                      '블로그 포스트';

  // 기본 사이트 정보
  const siteName = 'My Blog Platform';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  // 포스트 전체 URL
  const postUrl = `${siteUrl}/${params.blogSlug}/${params.postSlug}`;

  // 커버 이미지 URL (절대 경로로 변환)
  const ogImage = post.coverImage
    ? (post.coverImage.startsWith('http')
        ? post.coverImage
        : `${siteUrl}${post.coverImage}`)
    : `${siteUrl}/default-og-image.jpg`; // 기본 OG 이미지

  // 저자 정보
  const authorName = post.blog.user.username || post.blog.name;

  return {
    // 기본 메타 태그
    title: `${post.title} | ${post.blog.name}`,
    description,

    // 키워드 (태그가 있으면 사용)
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
      creator: `@${post.blog.user.username || post.blog.slug}`,
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const postUrl = `${siteUrl}/${params.blogSlug}/${params.postSlug}`;

  // 커버 이미지 URL (절대 경로로 변환)
  const imageUrl = post.coverImage
    ? (post.coverImage.startsWith('http')
        ? post.coverImage
        : `${siteUrl}${post.coverImage}`)
    : undefined;

  // Article 구조화된 데이터
  const articleData = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt || post.summary || post.content?.replace(/<[^>]*>/g, '').substring(0, 160),
    url: postUrl,
    datePublished: post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.blog.user.username || post.blog.name,
      url: `${siteUrl}/${params.blogSlug}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'My Blog Platform',
      url: siteUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
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
    ...(post.tags && post.tags.length > 0 && {
      keywords: post.tags.join(', '),
    }),
    ...(post.readingTime && {
      timeRequired: `PT${post.readingTime}`,
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
}: {
  params: { blogSlug: string; postSlug: string };
}) {
  // 포스트 데이터 미리 가져오기 (404 체크용)
  const post = await getPost(params.blogSlug, params.postSlug);

  // 포스트가 없으면 404 페이지로
  if (!post) {
    notFound();
  }

  // JSON-LD 구조화된 데이터 생성
  const structuredData = generateStructuredData(post, params);

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
      <BlogPostDetailClient />
    </>
  );
}