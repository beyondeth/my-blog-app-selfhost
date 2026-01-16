import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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

  // /@alias 형식의 URL을 /username으로 리다이렉트
  // 단, 정적 리소스나 API 경로는 제외
  if (pathname.startsWith('/@') && !pathname.startsWith('/@/') && !pathname.startsWith('/api/')) {
    const alias = pathname.slice(2); // @ 제거
    const searchParams = request.nextUrl.search;

    // 301 영구 리다이렉트
    return NextResponse.redirect(
      new URL(`/${alias}${searchParams}`, request.url),
      301
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match protected routes and alias routes
     */
    '/bookmarks/:path*',
    '/new-story/:path*',
    '/settings/:path*',
    '/@:path*', // Match /@... but be careful with syntax
  ],
};