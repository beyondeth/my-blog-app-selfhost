/**
 * 판매 상품 미리보기 콘텐츠 추출 유틸
 *
 * 우선순위:
 * 1. <!-- preview-end --> 마커가 있으면 그 위까지 추출
 * 2. 마커 없으면 전체 콘텐츠의 앞 30% (최소 5줄) 자동 추출
 */

const PREVIEW_END_MARKER = "<!-- preview-end -->";

/**
 * 마크다운/HTML 콘텐츠에서 미리보기 영역 추출
 * @param content 전체 콘텐츠 (마크다운 또는 HTML)
 * @returns 미리보기 콘텐츠 또는 null
 */
export function extractPreviewContent(
  content: string | null | undefined,
): string | null {
  if (!content || content.trim().length === 0) return null;

  // 1순위: <!-- preview-end --> 마커 기준 분리
  const markerIdx = content.indexOf(PREVIEW_END_MARKER);
  if (markerIdx !== -1) {
    const preview = content.substring(0, markerIdx).trim();
    return preview.length > 0 ? preview : null;
  }

  // 2순위: 마커 없으면 앞 30% 자동 추출 (최소 5줄, 최대 50줄)
  const lines = content.split("\n");
  const cutoff = Math.min(
    Math.max(Math.ceil(lines.length * 0.3), 5),
    50,
  );
  const preview = lines.slice(0, cutoff).join("\n").trim();
  return preview.length > 0 ? preview : null;
}

/**
 * HTML 콘텐츠에서 목차(headings) 추출
 * 구매 전 상품의 전체 구성을 파악할 수 있도록 h2, h3 태그 추출
 */
export function extractTableOfContents(
  htmlContent: string | null | undefined,
): string[] {
  if (!htmlContent) return [];

  const headingRegex = /<h[23][^>]*>(.*?)<\/h[23]>/gi;
  const headings: string[] = [];
  let match;

  while ((match = headingRegex.exec(htmlContent)) !== null) {
    // HTML 태그 제거
    const text = match[1].replace(/<[^>]*>/g, "").trim();
    if (text.length > 0) {
      headings.push(text);
    }
  }

  return headings;
}
