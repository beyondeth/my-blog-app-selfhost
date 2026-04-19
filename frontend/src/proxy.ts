import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_LOCALE,
  LOCALE_HEADER_NAME,
  extractLocaleFromPathname,
} from '@/lib/i18n/config';

const PROTECTED_ROUTES = ['/bookmarks', '/new-story', '/settings'];
const AUTH_COOKIE_NAMES = ['connect.sid', 'Authentication', 'access_token', 'token', 'session'];
const RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  'account',
  'admin',
  'analytics',
  'api',
  'auth',
  'blog',
  'bookmarks',
  'c',
  'community',
  'desktop',
  'dm',
  'docs',
  'drafts',
  'invite',
  'landing',
  'legal',
  'login',
  'marketplace',
  'mobile',
  'mock-checkout',
  'mock-home-shell',
  'mock-home-shell-harbor',
  'mock-home-shell-harbor-white',
  'mock-home-shell-ink',
  'mock-home-shell-ko',
  'new-story',
  'p',
  'product',
  'pricing',
  'privacy',
  'register',
  'replica',
  'settings',
  'simple',
  'support',
  'terms',
  'updates',
]);

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getCandidateBlogRoute(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0 || segments.length > 2) {
    return null;
  }

  const [rawFirstSegment, ...restSegments] = segments;
  const decodedFirstSegment = safeDecode(rawFirstSegment);
  const normalizedIdentifier = decodedFirstSegment.startsWith('@')
    ? decodedFirstSegment.slice(1)
    : decodedFirstSegment;

  if (!normalizedIdentifier || RESERVED_TOP_LEVEL_SEGMENTS.has(normalizedIdentifier)) {
    return null;
  }

  return {
    normalizedIdentifier,
    restSegments,
  };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER_NAME, DEFAULT_LOCALE);
  const {
    hasLocalePrefix,
    pathnameWithoutLocale,
  } = extractLocaleFromPathname(pathname);

  if (pathname === '/') {
    const hasAuthCookie = AUTH_COOKIE_NAMES.some(name => request.cookies.has(name));

    if (!hasAuthCookie) {
      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = '/product';

      return NextResponse.rewrite(rewriteUrl, {
        request: {
          headers: requestHeaders,
        },
      });
    }

    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = isMobile ? '/mobile' : '/desktop';

    return NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (hasLocalePrefix) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathnameWithoutLocale;
    return NextResponse.redirect(redirectUrl, 308);
  }

  // Protected routes logic
  const isProtectedRoute = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    const hasAuthCookie = AUTH_COOKIE_NAMES.some(name => request.cookies.has(name));

    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const candidateRoute = getCandidateBlogRoute(pathname);
  if (candidateRoute) {
    try {
      const blogLookupUrl = new URL(
        `/api/v1/blogs/slug/${encodeURIComponent(candidateRoute.normalizedIdentifier)}`,
        request.url,
      );
      const blogResponse = await fetch(blogLookupUrl, {
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.get('cookie')
            ? { Cookie: request.headers.get('cookie') as string }
            : {}),
        },
        cache: 'no-store',
      });

      if (blogResponse.ok) {
        const blog = await blogResponse.json();
        const canonicalSegment = blog.shouldRedirect && blog.redirectTo
          ? blog.redirectTo
          : blog.alias
            ? `@${blog.alias}`
            : blog.slug;

        if (canonicalSegment) {
          const restPath = candidateRoute.restSegments.length > 0
            ? `/${candidateRoute.restSegments.join('/')}`
            : '';
          const canonicalPath = `/${canonicalSegment}${restPath}`;

          if (pathname !== canonicalPath) {
            const redirectUrl = request.nextUrl.clone();
            redirectUrl.pathname = canonicalPath;
            return NextResponse.redirect(redirectUrl, 308);
          }
        }
      }
    } catch {
      // Ignore blog lookup errors and continue rendering the current request.
    }
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
};
