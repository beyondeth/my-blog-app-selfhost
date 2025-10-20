import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * 법적 문서 Markdown 파일을 제공하는 API 라우트
 *
 * @param request - Next.js Request 객체
 * @param params - URL 파라미터 (type: 문서 타입)
 * @returns Markdown 파일 내용
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { type: string } }
) {
  try {
    const { type } = params;
    const searchParams = request.nextUrl.searchParams;
    const lang = searchParams.get('lang') || 'ko';

    // 허용된 문서 타입 검증
    const allowedTypes = [
      'terms-of-service',
      'privacy-policy',
      'community-guidelines',
      'pro-terms',
      'partner-program',
      'username-policy',
    ];

    if (!allowedTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid document type' },
        { status: 400 }
      );
    }

    // 언어 검증
    if (lang !== 'ko' && lang !== 'en') {
      return NextResponse.json(
        { error: 'Invalid language' },
        { status: 400 }
      );
    }

    // 파일 경로 생성
    const projectRoot = process.cwd();
    const filePath = path.join(
      projectRoot,
      '..',
      'backend',
      'docs',
      'legal',
      lang,
      `${type}.md`
    );

    // 파일 존재 여부 확인
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // 파일 읽기
    const markdown = fs.readFileSync(filePath, 'utf-8');

    // Markdown 콘텐츠 반환
    return new NextResponse(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Cache-Control': 'public, max-age=3600', // 1시간 캐싱
      },
    });
  } catch (error) {
    console.error('Error serving legal document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
