/**
 * Open Graph API 서비스
 *
 * @description
 * URL에서 Open Graph 메타데이터를 가져오는 API 서비스입니다.
 * 링크 카드 표시에 사용됩니다.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * Open Graph 메타데이터 응답 타입
 */
export interface OpenGraphData {
  /** 원본 URL */
  url: string;
  /** 페이지 제목 */
  title?: string;
  /** 페이지 설명 */
  description?: string;
  /** 대표 이미지 URL */
  imageUrl?: string;
  /** 사이트 이름 */
  siteName?: string;
  /** 콘텐츠 타입 */
  type?: string;
  /** 파비콘 URL */
  faviconUrl?: string;
  /** 도메인 */
  domain?: string;
  /** 성공 여부 */
  success: boolean;
  /** 에러 메시지 */
  error?: string;
}

/**
 * URL에서 Open Graph 메타데이터 조회
 *
 * @param url 메타데이터를 조회할 URL
 * @returns Open Graph 메타데이터
 *
 * @example
 * ```typescript
 * const og = await fetchOpenGraph('https://github.com/user/repo');
 * if (og.success) {
 *   console.log(og.title, og.description);
 * }
 * ```
 */
export async function fetchOpenGraph(url: string): Promise<OpenGraphData> {
  try {
    const encodedUrl = encodeURIComponent(url);
    const response = await fetch(
      `${API_URL}/opengraph?url=${encodedUrl}`,
      {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return {
        url,
        domain: extractDomain(url),
        success: false,
        error: `HTTP ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      url,
      domain: extractDomain(url),
      success: false,
      error: error instanceof Error ? error.message : '알 수 없는 오류',
    };
  }
}

/**
 * URL에서 도메인 추출
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}
