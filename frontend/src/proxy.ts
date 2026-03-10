import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Mobile/Desktop Routing (Code Splitting) logic
  if (pathname === '/') {
    const userAgent = request.headers.get('user-agent') || '';
    const isMobile = /mobile|android|iphone|ipad|ipod/i.test(userAgent);

    if (isMobile) {
      return NextResponse.rewrite(new URL('/mobile', request.url));
    } else {
      return NextResponse.rewrite(new URL('/desktop', request.url));
    }
  }

  // Protected routes logic
  const protectedRoutes = ['/bookmarks', '/new-story', '/settings'];
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));

  if (isProtectedRoute) {
    const authCookieNames = ['connect.sid', 'Authentication', 'access_token', 'token', 'session'];
    const hasAuthCookie = authCookieNames.some(name => request.cookies.has(name));

    if (!hasAuthCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match protected routes, alias routes, and root path
     */
    '/',
    '/bookmarks/:path*',
    '/new-story/:path*',
    '/settings/:path*',
  ],
};
