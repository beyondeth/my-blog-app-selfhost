import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth 인증 데이터 프록시 API
 * 백엔드로 쿠키를 포함한 요청을 전달
 */
export async function GET(request: NextRequest) {
  try {
    // 백엔드 URL 설정 (환경 변수 사용)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

    // 쿼리 파라미터 전달
    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${backendUrl}/api/v1/oauth/authorize-data${searchParams ? `?${searchParams}` : ''}`;

    // 쿠키 가져오기
    const cookieHeader = request.headers.get('cookie') || '';

    // 백엔드로 요청 전달 (쿠키 포함)
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      },
      // Next.js fetch에서는 credentials 대신 headers에 쿠키 전달
    });

    // 응답 처리
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch authorization data' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('OAuth authorize-data proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}