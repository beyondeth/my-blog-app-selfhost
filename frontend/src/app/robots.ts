import { MetadataRoute } from 'next';

/**
 * Next.js 14 Native Robots.txt 생성
 *
 * @description
 * 검색 엔진 크롤러를 위한 robots.txt를 자동 생성합니다.
 * - 공개 페이지: 크롤링 허용 (홈, 블로그, 포스트, 법적 문서)
 * - 민감 경로: 크롤링 차단 (관리자, 설정, API, 인증, DM 등)
 * - Sitemap 위치 명시
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots
 */

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';

  return {
    rules: {
      userAgent: '*',
      allow: [
        // 공개 페이지 허용
        '/',
        '/pricing',
        '/support',
        '/landing',
        '/legal/',
      ],
      disallow: [
        // ==========================================
        // 관리자 경로 (11개)
        // ==========================================
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

        // ==========================================
        // 사용자 설정 경로 (7개)
        // ==========================================
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

        // ==========================================
        // API 엔드포인트
        // ==========================================
        '/api',
        '/api/',
        '/api/*',

        // ==========================================
        // 인증 경로 (6개)
        // ==========================================
        '/login',
        '/register',
        '/consent',
        '/forgot-password',
        '/reset-password',
        '/auth/callback',

        // ==========================================
        // 사용자 전용 경로 (7개)
        // ==========================================
        '/dm',
        '/dm/',
        '/dm/*',
        '/bookmarks',
        '/new-story',
        '/account/subscription',
        '/p/*/edit',

        // ==========================================
        // 디버그 & 테스트 경로
        // ==========================================
        '/mock-checkout',
        '/debug-excerpt',
        '/analytics',
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
