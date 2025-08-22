import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // Admin 경로 접근 시 권한 체크는 클라이언트에서 처리
  // 여기서는 단순 라우팅만 처리
  if (pathname.startsWith('/admin')) {
    // Admin 경로는 통과 (실제 권한 체크는 컴포넌트에서)
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};