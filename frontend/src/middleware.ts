import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  
  // /admin 경로 접근 시도
  if (pathname.startsWith('/admin')) {
    try {
      // 쿠키에서 access_token 확인
      const cookies = request.cookies.get('access_token');
      
      // 토큰이 없으면 로그인 화면 보여줄 것임
      if (!cookies) {
        return NextResponse.next();
      }
      
      // 백엔드에 사용자 정보 확인
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          'Cookie': request.headers.get('cookie') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        
        // Admin이 아닌 경우 - 아무 반응 없이 이전 페이지로
        if (data.role !== 'admin') {
          // Referer가 있으면 그 페이지로, 없으면 홈으로 (리다이렉트 메시지 없이)
          const referer = request.headers.get('referer');
          if (referer && !referer.includes('/admin')) {
            return NextResponse.redirect(new URL(referer));
          }
          // 조용히 홈으로 리다이렉트
          return NextResponse.redirect(new URL('/', request.url));
        }
        
        // Admin인 경우에도 재인증 필요하므로 그냥 진행
        return NextResponse.next();
      }
      
      // API 호출 실패 시 로그인 화면
      return NextResponse.next();
      
    } catch (error) {
      // 에러 발생 시 조용히 홈으로
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*']
};