import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * 법적 문서 Markdown 파일을 제공하는 API 라우트
 *
 * ⚠️ DEPRECATED: 모든 법적 문서는 이제 /public/legal 에서 직접 제공됩니다.
 *
 * 주요 문서(privacy, terms, guidelines, marketing)는 /public/legal 에서 직접 제공되며
 * LegalPageLayout 컴포넌트가 getLegalFilePath()를 통해 버전 관리된 정적 파일을 로드합니다.
 *
 * 이 API 라우트는 레거시 fallback용으로만 유지됩니다.
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
    // 모든 주요 문서는 이제 정적 파일로 직접 제공됨
    const allowedTypes = [
      'terms-of-service',          // 레거시 fallback용
      'privacy-policy',             // 레거시 fallback용
      'community-guidelines',       // 레거시 fallback용
      'marketing-consent',          // 레거시 fallback용
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
