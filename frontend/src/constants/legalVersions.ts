/**
 * Legal 문서 버전 중앙 관리
 *
 * 문서 업데이트 시 이 파일만 수정하면 모든 링크가 자동으로 업데이트됩니다.
 *
 * 파일명 형식: {type}-{YYYYMMDD}-v{major}.{minor}.md
 * 예: privacy-policy-20251029-v1.0.md
 */

export const LEGAL_VERSIONS = {
  PRIVACY: '20251029-v1.0',
  TERMS: '20251029-v1.0',
  GUIDELINES: '20251029-v1.0',
  MARKETING: '20251029-v1.0',
  NEWSLETTER: '20251029-v1.0',
} as const;

/**
 * Legal 문서 파일 경로 생성 헬퍼 함수
 *
 * Cloudflare가 .md 파일 직접 접근을 차단하므로
 * API Route를 통해 서빙 (/api/legal/...)
 */
export function getLegalFilePath(type: keyof typeof LEGAL_VERSIONS, lang: 'ko' | 'en' = 'ko'): string {
  const typeMap = {
    PRIVACY: 'privacy-policy',
    TERMS: 'terms-of-service',
    GUIDELINES: 'community-guidelines',
    MARKETING: 'marketing-consent',
    NEWSLETTER: 'newsletter-consent',
  };

  const fileName = typeMap[type];
  const version = LEGAL_VERSIONS[type];

  return `/api/legal/${lang}/${fileName}-${version}.md`;
}
