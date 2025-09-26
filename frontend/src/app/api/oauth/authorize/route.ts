import { NextRequest, NextResponse } from 'next/server';

/**
 * OAuth 인증 승인/거부 프록시 API
 * 백엔드로 쿠키를 포함한 POST 요청을 전달
 */
export async function POST(request: NextRequest) {
  try {
    // 백엔드 URL 설정 (환경 변수 사용)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
    const url = `${backendUrl}/api/v1/oauth/authorize`;

    // 요청 바디 가져오기
    const body = await request.json();

    // 쿠키 가져오기
    const cookieHeader = request.headers.get('cookie') || '';

    // 백엔드로 요청 전달 (쿠키 포함)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // 응답 처리
    if (!response.ok) {
      const errorText = await response.text();

      // 401 에러는 그대로 전달 (로그인 필요)
      if (response.status === 401) {
        return NextResponse.json(
          { error: '로그인이 필요합니다.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: errorText || 'Authorization failed' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('OAuth authorize proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}