import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

function renderTemplate(content: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  const version =
    process.env.LEGAL_DOCUMENT_VERSION || '20260823-v1.0';
  const replacements: Record<string, string> = {
    OPERATOR_NAME: process.env.OPERATOR_NAME || 'Aigory',
    OPERATOR_CONTACT_EMAIL:
      process.env.OPERATOR_CONTACT_EMAIL || 'support@aigory.com',
    LEGAL_TERMS_URL: process.env.LEGAL_TERMS_URL || `${siteUrl}/legal/terms`,
    LEGAL_PRIVACY_URL:
      process.env.LEGAL_PRIVACY_URL || `${siteUrl}/legal/privacy`,
    LEGAL_DOCUMENT_VERSION: version,
    PUBLIC_SITE_URL: siteUrl,
  };

  return content.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_match, key) => {
    return replacements[key] ?? '';
  });
}

/**
 * Legal 문서 API Route
 *
 * GET /api/legal/ko/privacy-policy-20251029-v1.0.md
 * → public/legal/ko/privacy-policy-20251029-v1.0.md 파일을 읽어서 응답
 *
 * Cloudflare가 .md 파일 직접 접근을 차단하는 문제를 우회하기 위해
 * API Route로 파일을 서빙합니다.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    // Next.js 16: params는 이제 Promise (async)
    const resolvedParams = await params;

    // 경로 파라미터 결합 (예: ['ko', 'privacy-policy-20251029-v1.0.md'])
    const filePath = resolvedParams.path.join('/');

    // public/legal/ 폴더 내 파일만 허용 (보안)
    if (!filePath || filePath.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 },
      );
    }

    // 파일 시스템에서 읽기 (프로덕션: .next/standalone/public/, 개발: public/)
    const publicDir = join(process.cwd(), 'public');
    const absolutePath = join(publicDir, 'legal', filePath);

    // 파일 읽기
    const content = renderTemplate(await readFile(absolutePath, 'utf-8'));

    // text/plain으로 응답 (마크다운 원본)
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // 파일명에 버전 포함되므로 1년 캐싱 (immutable)
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    // 파일 없음 또는 읽기 실패
    console.error('Legal document read error:', error);
    return NextResponse.json(
      { error: 'Document not found' },
      { status: 404 },
    );
  }
}
