import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import BlogClientPage from './client-page';

// 중복 API 호출 방지를 위한 React Cache 적용
const getBlog = cache(async (slug: string) => {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
    // fetch URL: /blogs/slug/:slug
    // slug에 @가 포함된 경우 그대로 전달 (백엔드 처리)
    const res = await fetch(`${apiUrl}/blogs/slug/${slug}`, {
      next: { revalidate: 60 }, // 1분 캐시
    });

    if (!res.ok) {
      return null;
    }

    const json = await res.json();
    // 백엔드 응답 구조가 성공 시 data 필드에 블로그 정보를 담고 있다고 가정
    // 실제 응답 확인 필요 (useBlogBySlug -> getBlogBySlug -> axios response.data)
    // 기존 api.ts getBlogBySlug는 response.data를 반환
    return json; 
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

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'Codebase';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  // 실제 블로그 URL (alias가 있으면 alias 사용)
  const currentPath = blog.alias ? `@${blog.alias}` : blog.slug;
  const blogUrl = `${siteUrl}/${currentPath}`;
  
  const description = blog.description || `${blog.name}님의 기술 블로그입니다.`;
  const imageUrl = blog.coverImageUrl || blog.iconUrl || `${siteUrl}/og-image-v2.png`;
  
  // 브랜드 컬러 (theme-color)
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
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: blog.name,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: blog.name,
      description: description,
      images: [imageUrl],
    },
    // 테마 컬러 설정 (모바일 브라우저 탭 색상 등)
    other: themeColor ? {
      'theme-color': themeColor,
    } : undefined,
    icons: blog.iconUrl ? {
      icon: blog.iconUrl,
      apple: blog.iconUrl,
    } : undefined,
  };
}

export default async function BlogHomePage({ params }: PageProps) {
  const { blogSlug } = await params;
  const decodedSlug = decodeURIComponent(blogSlug);
  const blog = await getBlog(decodedSlug);

  if (!blog) {
    notFound();
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
        url: `${siteUrl}/logo.png`, // 로고 경로 확인 필요
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
