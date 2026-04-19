import { MetadataRoute } from 'next';
import { WRITING_STYLE_DOCS } from '@/lib/writing-style-docs';
import { FEATURES } from '@/lib/features';

export const revalidate = 43200;

async function fetchWithTimeout(url: string, timeout = 5000): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: 43200 },
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

const publicRoutes = [
  {
    url: '/product',
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

if (FEATURES.SUBSCRIPTION) {
  publicRoutes.push({
    url: '/pricing',
    priority: 0.8,
    changeFrequency: 'weekly' as const,
  });
}

const staticRoutes = [
  {
    url: '/',
    priority: 1.0,
    changeFrequency: 'daily' as const,
  },
  ...publicRoutes,
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
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
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

    const blogEntries: MetadataRoute.Sitemap = blogs.map((blog) => ({
      url: `${baseUrl}/${blog.slug}`,
      lastModified: new Date(blog.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const postEntries: MetadataRoute.Sitemap = posts.map((post) => ({
      url: `${baseUrl}/${post.blogSlug}/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'monthly',
      priority: 0.7,
    }));

    const communityPostEntries: MetadataRoute.Sitemap = communityPosts.map((post) => ({
      url: `${baseUrl}/c/${post.communitySlug}/comments/${post.slug}`,
      lastModified: new Date(post.updatedAt),
      changeFrequency: 'weekly',
      priority: 0.6,
    }));

    const allEntries = [...staticEntries, ...blogEntries, ...postEntries, ...communityPostEntries];
    console.log(
      `[Sitemap] Generated ${allEntries.length} total entries (${staticEntries.length} static, ${blogs.length} blogs, ${posts.length} posts, ${communityPosts.length} community posts)`,
    );

    return allEntries;
  } catch (error) {
    console.error('[Sitemap] Fatal error fetching dynamic routes, returning static routes only:', error);
    return staticEntries;
  }
}
