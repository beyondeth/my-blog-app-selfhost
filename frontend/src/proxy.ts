import { NextResponse, type NextRequest } from 'next/server';
import { shouldHideProductionRoute } from '@/lib/security/production-route-policy';

export function proxy(request: NextRequest) {
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
    '/pricing/:path*',
    '/account/subscription/:path*',
    '/mock-checkout/:path*',
    '/admin/debug/:path*',
  ],
};
