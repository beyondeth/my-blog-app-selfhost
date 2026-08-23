import DOMPurify, { type Config } from 'dompurify';

const COMMUNITY_HTML_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'mark',
    'sub',
    'sup',
    'del',
    'ins',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'blockquote',
    'a',
    'img',
    'figure',
    'figcaption',
    'code',
    'pre',
    'span',
    'kbd',
    'samp',
    'var',
    'div',
    'hr',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'caption',
    'colgroup',
    'col',
    'button',
  ],
  ALLOWED_ATTR: [
    'href',
    'src',
    'alt',
    'title',
    'target',
    'rel',
    'width',
    'height',
    'class',
    'style',
    'id',
    'loading',
    'decoding',
  ],
  ALLOW_DATA_ATTR: true,
  KEEP_CONTENT: true,
};

export function sanitizeCommunityHtmlForBrowser(html: string): string {
  // SSR 콘텐츠는 CommunityPostService의 read-time sanitizer를 통과한 응답이다.
  // 브라우저 재조회 데이터는 DOM에 주입하기 직전에 한 번 더 정제한다.
  if (typeof window === 'undefined') {
    return html;
  }

  return DOMPurify.sanitize(html, COMMUNITY_HTML_CONFIG);
}
