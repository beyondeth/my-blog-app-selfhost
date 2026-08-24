import { NextResponse, type NextRequest } from 'next/server';
import {
  detectPreferredLocale,
  extractLocaleFromPathname,
  isSupportedLocale,
  LOCALE_COOKIE_NAME,
  LOCALE_HEADER_NAME,
} from '@/lib/i18n/config';
import { shouldHideProductionRoute } from '@/lib/security/production-route-policy';

export function proxy(request: NextRequest) {
  const localizedPath = extractLocaleFromPathname(request.nextUrl.pathname);

  if (localizedPath.pathnameWithoutLocale === '/product') {
    const explicitLocale = localizedPath.locale;
    const cookieLocale = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
    const locale = explicitLocale
      ?? (isSupportedLocale(cookieLocale) ? cookieLocale : null)
      ?? detectPreferredLocale(request.headers.get('accept-language'));

    if (!localizedPath.hasLocalePrefix) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = `/${locale}/product`;
      const response = NextResponse.redirect(redirectUrl, 307);
      response.cookies.set(LOCALE_COOKIE_NAME, locale, {
        maxAge: 365 * 24 * 60 * 60,
        path: '/',
        sameSite: 'lax',
        secure: request.nextUrl.protocol === 'https:',
      });
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Vary', 'Cookie, Accept-Language');
      return response;
    }

    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = '/product';
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(LOCALE_HEADER_NAME, locale);
    const response = NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      maxAge: 365 * 24 * 60 * 60,
      path: '/',
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
    });
    return response;
  }

  if (!shouldHideProductionRoute(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return new NextResponse('Not Found', {
    status: 404,
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export const config = {
  matcher: [
    '/product',
    '/en/product',
    '/ko/product',
    '/pricing/:path*',
    '/account/subscription/:path*',
    '/mock-checkout/:path*',
    '/admin/debug/:path*',
  ],
};
