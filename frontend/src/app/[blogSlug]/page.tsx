import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
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

function getCanonicalBlogPath(blog: any): string {
  if (blog?.shouldRedirect && blog?.redirectTo) {
    return blog.redirectTo.startsWith('@')
      ? `/${blog.redirectTo}`
      : `/@${blog.redirectTo}`;
  }

  if (blog?.alias) {
    return `/@${blog.alias}`;
  }

  return `/${blog?.slug ?? ''}`;
}

function isPrivateBlogSentinel(blog: any): boolean {
  return Boolean(blog?.isPrivate && !blog?.name);
}

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

  const canonicalPath = getCanonicalBlogPath(blog);
  const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}${canonicalPath}`;

  // 비공개 블로그: SEO 노출 최소화
  if (isPrivateBlogSentinel(blog)) {
    return {
      title: '비공개 블로그',
      description: '이 블로그는 비공개 상태입니다.',
      robots: { index: false, follow: false },
      alternates: {
        canonical: canonicalUrl,
      },
    };
  }

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const blogUrl = canonicalUrl;
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
    alternates: {
      canonical: blogUrl,
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

  if (isPrivateBlogSentinel(blog)) {
    notFound();
  }

  const canonicalPath = getCanonicalBlogPath(blog);
  if (canonicalPath && canonicalPath !== `/${decodedSlug}`) {
    permanentRedirect(canonicalPath);
  }

  // JSON-LD 구조화된 데이터 생성
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const blogUrl = `${siteUrl}${canonicalPath}`;

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
