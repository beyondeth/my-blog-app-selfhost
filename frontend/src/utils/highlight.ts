/**
 * 검색어 하이라이팅 유틸리티
 * 검색된 텍스트에서 검색어를 강조 표시
 */

/**
 * 텍스트에서 검색어를 하이라이팅
 * @param text - 원본 텍스트
 * @param searchQuery - 검색어
 * @returns 하이라이팅된 HTML 문자열
 */
export function highlightSearchTerms(
  text: string | null | undefined,
  searchQuery: string | null | undefined
): string {
  if (!text) {
    return '';
  }

  if (!searchQuery) {
    return escapeHtml(text);
  }

  const searchTerms = searchQuery
    .trim()
    .split(/\s+/)
    .filter(term => term.length > 0)
    .map(term => escapeRegExp(term));

  if (searchTerms.length === 0) {
    return escapeHtml(text);
  }

  const regex = new RegExp(`(${searchTerms.join('|')})`, 'gi');

  let result = '';
  let lastIndex = 0;

  text.replace(regex, (match, _group, offset) => {
    result += escapeHtml(text.slice(lastIndex, offset));
    result += `<mark class="search-highlight">${escapeHtml(match)}</mark>`;
    lastIndex = offset + match.length;
    return match;
  });

  result += escapeHtml(text.slice(lastIndex));

  return result;
}

/**
 * 정규표현식 특수문자 이스케이프
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * HTML을 React 컴포넌트에서 안전하게 렌더링하기 위한 객체 생성
 * dangerouslySetInnerHTML에 사용
 */
export function createHighlightedHTML(
  text: string | null | undefined,
  searchQuery: string | null | undefined
) {
  return { __html: highlightSearchTerms(text, searchQuery) };
}

/**
 * 텍스트 길이 제한 및 하이라이팅
 * excerpt가 없을 때 content에서 추출하는 경우 사용
 */
export function highlightAndTruncate(
  text: string | null | undefined,
  searchQuery: string | null | undefined,
  maxLength: number = 200
): string {
  if (!text) return '';

  // HTML 태그 제거
  const plainText = text.replace(/<[^>]*>/g, '');

  // 길이 제한
  const truncated = plainText.length > maxLength
    ? plainText.substring(0, maxLength) + '...'
    : plainText;

  // 하이라이팅 적용
  return highlightSearchTerms(truncated, searchQuery);
}
