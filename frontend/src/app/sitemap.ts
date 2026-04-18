import { MetadataRoute } from 'next';
import { WRITING_STYLE_DOCS } from '@/lib/writing-style-docs';

/**
 * Next.js 14 Native Sitemap 생성
 *
 * @description
 * SEO 최적화를 위한 sitemap.xml을 자동 생성합니다.
 * - 정적 라우트: 홈, 법적 문서, 지원 페이지 등
 * - 동적 라우트: 공개 블로그, 발행된 포스트
 * - ISR 캐싱: 12시간마다 재생성
 * - 에러 핸들링: API 실패 시 정적 라우트만 반환
 * - Cloudflare 캐싱: 12시간 TTL
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

// ISR 재검증 주기: 12시간 (43200초)
// 기술 블로그는 실시간성이 필요 없으며, Google도 하루 1-2번만 크롤링합니다.
export const revalidate = 43200;

/**
 * 타임아웃이 있는 fetch 유틸리티
 *
 * @param url - 요청 URL
 * @param timeout - 타임아웃 시간 (밀리초, 기본 5초)
 * @returns Response 또는 null (타임아웃/실패 시)
 */
async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 43200 }, // ISR 캐싱 12시간
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if ((error as Error).name === 'AbortError') {
      console.error('[Sitemap] Fetch timeout:', url);
    } else {
      console.error('[Sitemap] Fetch error:', url, error);
    }
    return null;
  }
}

/**
 * 정적 라우트 정의
 * 민감하지 않은 공개 페이지만 포함
 */
const staticRoutes = [
  {
    url: '/',
    priority: 1.0,
    changeFrequency: 'daily' as const,
  },
  {
    url: '/product',
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/pricing',
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/updates',
    priority: 0.7,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/support',
    priority: 0.6,
    changeFrequency: 'monthly' as const,
  },
  {
    url: '/docs',
    priority: 0.7,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/docs/get-started',
    priority: 0.7,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/docs/publishing-flow',
    priority: 0.6,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/docs/mcp',
    priority: 0.6,
    changeFrequency: 'weekly' as const,
  },
  {
    url: '/docs/faq',
    priority: 0.5,
    changeFrequency: 'monthly' as const,
  },
  {
    url: '/docs/writing-styles',
    priority: 0.6,
    changeFrequency: 'monthly' as const,
  },
  ...WRITING_STYLE_DOCS.map((style) => ({
    url: `/docs/writing-styles/${style.id}`,
    priority: 0.5,
    changeFrequency: 'monthly' as const,
  })),
  {
    url: '/c',
    priority: 0.9,
    changeFrequency: 'daily' as const,
  },
  {
    url: '/community',
    priority: 0.7,
    changeFrequency: 'monthly' as const,
  },
  {
    url: '/legal/privacy',
    priority: 0.5,
    changeFrequency: 'yearly' as const,
  },
  {
    url: '/legal/terms',
    priority: 0.5,
    changeFrequency: 'yearly' as const,
  },
  {
    url: '/legal/guidelines',
    priority: 0.5,
    changeFrequency: 'yearly' as const,
  },
  {
    url: '/legal/marketing-consent',
    priority: 0.3,
    changeFrequency: 'yearly' as const,
  },
  {
    url: '/legal/newsletter-consent',
    priority: 0.3,
    changeFrequency: 'yearly' as const,
  },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // 정적 라우트를 sitemap 형식으로 변환
  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  // 동적 라우트 (블로그, 포스트) 추가 시도
  try {
    // 1. 공개 블로그 조회
    let blogs: Array<{ slug: string; updatedAt: string }> = [];
    const blogsResponse = await fetchWithTimeout(`${apiUrl}/blogs/sitemap/all`, 5000);

    if (blogsResponse?.ok) {
      try {
        blogs = await blogsResponse.json();
        console.log(`[Sitemap] Fetched ${blogs.length} blogs`);
      } catch (error) {
        console.error('[Sitemap] Failed to parse blogs JSON:', error);
      }
    } else {
      console.warn('[Sitemap] Blogs API failed, proceeding without blog entries');
    }

    // 2. 발행된 포스트 조회
    let posts: Array<{ slug: string; blogSlug: string; updatedAt: string }> = [];
    const postsResponse = await fetchWithTimeout(`${apiUrl}/posts/sitemap/all`, 5000);

    if (postsResponse?.ok) {
      try {
        posts = await postsResponse.json();
        console.log(`[Sitemap] Fetched ${posts.length} posts`);
      } catch (error) {
        console.error('[Sitemap] Failed to parse posts JSON:', error);
      }
    } else {
      console.warn('[Sitemap] Posts API failed, proceeding without post entries');
    }

    // 3. 커뮤니티 포스트 조회 (Reddit 스타일 URL)
    let communityPosts: Array<{ slug: string; communitySlug: string; updatedAt: string }> = [];
    const communityPostsResponse = await fetchWithTimeout(`${apiUrl}/community/sitemap/all`, 5000);

    if (communityPostsResponse?.ok) {
      try {
        communityPosts = await communityPostsResponse.json();
        console.log(`[Sitemap] Fetched ${communityPosts.length} community posts`);
      } catch (error) {
        console.error('[Sitemap] Failed to parse community posts JSON:', error);
      }
    } else {
      console.warn('[Sitemap] Community posts API failed, proceeding without community entries');
    }

    // 4. 블로그 sitemap 엔트리 생성
    const blogEntries: MetadataRoute.Sitemap = blogs.map((blog) => ({
      url: `${baseUrl}/${blog.slug}`,
      lastModified: new Date(blog.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    // 5. 블로그 포스트 sitemap 엔트리 생성
    const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${baseUrl}/${post.blogSlug}/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

    // 6. 커뮤니티 포스트 sitemap 엔트리 생성 (Reddit 스타일 URL)
    const communityPostEntries: MetadataRoute.Sitemap = communityPosts.map((post) => ({
      url: `${baseUrl}/c/${post.communitySlug}/comments/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    // 7. 모든 엔트리 병합 및 반환
    const allEntries = [...staticEntries, ...blogEntries, ...postEntries, ...communityPostEntries];
    console.log(`[Sitemap] Generated ${allEntries.length} total entries (${staticEntries.length} static, ${blogEntries.length} blogs, ${postEntries.length} posts, ${communityPostEntries.length} community posts)`);

    return allEntries;
  } catch (error) {
    // Fallback: API 실패 시 정적 라우트만 반환
    console.error('[Sitemap] Fatal error fetching dynamic routes, returning static routes only:', error);
    return staticEntries;
  }
}
