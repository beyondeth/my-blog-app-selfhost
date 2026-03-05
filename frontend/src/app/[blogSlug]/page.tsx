import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import BlogClientPage from './client-page';

// 중복 API 호출 방지를 위한 React Cache 적용
const getBlog = cache(async (slug: string) => {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

    // SSR 환경에서 인증 쿠키 포워딩 (소유자가 비공개 블로그 접근 시 정상 표시)
    let cookieHeader: string | undefined;
    try {
      const cookieStore = await cookies();
      cookieHeader = cookieStore.toString();
    } catch {
      // 쿠키 접근 불가한 경우 무시
    }

    const res = await fetch(`${apiUrl}/blogs/slug/${slug}`, {
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
        ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
      },
    });

    if (!res.ok) {
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error('Failed to fetch blog:', error);
    return null;
  }
});

interface PageProps {
  params: Promise<{ blogSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { blogSlug } = await params;
  const decodedSlug = decodeURIComponent(blogSlug);
  const blog = await getBlog(decodedSlug);

  if (!blog) {
    return {
      title: '블로그를 찾을 수 없습니다',
      description: '요청하신 블로그를 찾을 수 없습니다.',
    };
  }

  // 비공개 블로그: SEO 노출 최소화
  if (blog.isPrivate) {
    return {
      title: '비공개 블로그',
      description: '이 블로그는 비공개 상태입니다.',
      robots: { index: false, follow: false },
    };
  }

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const currentPath = blog.alias ? `@${blog.alias}` : blog.slug;
  const blogUrl = `${siteUrl}/${currentPath}`;
  const description = blog.description || `${blog.name}님의 기술 블로그입니다.`;
  const imageUrl = blog.coverImageUrl || blog.iconUrl || `${siteUrl}/og-image-v2.png`;
  const themeColor = blog.brandColor || undefined;

  return {
    title: `${blog.name} | ${siteName}`,
    description: description,
    openGraph: {
      type: 'website',
      title: blog.name,
      description: description,
      url: blogUrl,
      siteName: siteName,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: blog.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: blog.name,
      description: description,
      images: [imageUrl],
    },
    other: themeColor ? { 'theme-color': themeColor } : undefined,
    icons: blog.iconUrl ? { icon: blog.iconUrl, apple: blog.iconUrl } : undefined,
  };
}

export default async function BlogHomePage({ params }: PageProps) {
  const { blogSlug } = await params;
  const decodedSlug = decodeURIComponent(blogSlug);
  const blog = await getBlog(decodedSlug);

  if (!blog) {
    notFound();
  }

  // 비공개 블로그 접근 차단 (소유자가 아닌 경우)
  if (blog.isPrivate) {
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

  // JSON-LD 구조화된 데이터 생성
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const currentPath = blog.alias ? `@${blog.alias}` : blog.slug;
  const blogUrl = `${siteUrl}/${currentPath}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: blog.name,
    description: blog.description || `${blog.name}님의 블로그`,
    url: blogUrl,
    image: blog.coverImageUrl || blog.iconUrl,
    author: {
      '@type': 'Person',
      name: blog.owner?.username || blog.name,
      url: blogUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Codebase',
      logo: {
        '@type': 'ImageObject',
        url: `${siteUrl}/logo.png`,
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogClientPage initialBlog={blog} blogSlug={decodedSlug} />
    </>
  );
}
