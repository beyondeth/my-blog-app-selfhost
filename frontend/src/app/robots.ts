import { MetadataRoute } from 'next';
import { FEATURES } from '@/lib/features';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.codebase.blog';
  const allowRules = ['/', '/docs', '/product', '/updates', '/support', '/legal/'];

  if (FEATURES.SUBSCRIPTION) {
    allowRules.push('/pricing');
  }

  return {
    rules: {
      userAgent: '*',
      allow: allowRules,
      disallow: [
        '/admin',
        '/admin/',
        '/admin/*',
        '/admin/settings',
        '/admin/email-approvals',
        '/admin/posts',
        '/admin/redis',
        '/admin/images',
        '/admin/mcp',
        '/admin/users',
        '/admin/users/deleted',
        '/admin/monitoring',
        '/admin/reports',
        '/admin/debug',

        '/settings',
        '/settings/',
        '/settings/*',
        '/settings/api-keys',
        '/settings/blog',
        '/settings/dm',
        '/settings/security',
        '/settings/relationships',
        '/settings/notifications',
        '/settings/connected-apps',

        '/api',
        '/api/',
        '/api/*',

        '/login',
        '/register',
        '/consent',
        '/forgot-password',
        '/reset-password',
        '/auth/callback',
        '/dm',
        '/dm/',
        '/dm/*',
        '/bookmarks',
        '/new-story',
        '/account/subscription',
        '/p/*/edit',

        '/mock-checkout',
        '/debug-excerpt',
        '/analytics',
        '/en',
        '/en/*',
        '/ko',
        '/ko/*',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
