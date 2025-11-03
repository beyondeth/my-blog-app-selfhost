import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
     * Match only paths starting with /@ to avoid interfering with other routes
     */
    '/@/:path*',
  ],
};