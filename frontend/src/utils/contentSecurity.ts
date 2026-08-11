const DEFAULT_ALLOWED_HOSTS = new Set<string>();

function addHostFromEnv(value?: string | null) {
  if (!value) return;
  try {
    const parsed = new URL(value);
    if (parsed.hostname) {
      DEFAULT_ALLOWED_HOSTS.add(parsed.hostname.toLowerCase());
    }
  } catch {
    // ignore invalid env values
  }
}

addHostFromEnv(process.env.NEXT_PUBLIC_CDN_BASE_URL);
addHostFromEnv(process.env.NEXT_PUBLIC_API_URL);
addHostFromEnv(process.env.NEXT_PUBLIC_BACKEND_URL);

const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const DISALLOWED_EXTENSIONS = ['.svg'];

export type ContentMode = 'markdown' | 'html';

function getDisallowedReason(rawUrl: string): string | null {
  const url = rawUrl.trim();
  if (!url) {
    return '이미지 URL이 비어 있습니다.';
  }

  const lower = url.toLowerCase();
  if (lower.startsWith('data:') || lower.startsWith('javascript:')) {
    return 'data:, javascript: 프로토콜은 허용되지 않습니다.';
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://') && !lower.startsWith('/')) {
    return '지원되지 않는 이미지 경로 형식입니다.';
  }

  if (lower.startsWith('/')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '유효하지 않은 이미지 URL입니다.';
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!DEFAULT_ALLOWED_HOSTS.has(hostname)) {
    return `허용되지 않은 도메인의 이미지입니다: ${hostname}`;
  }

  const pathname = parsed.pathname.toLowerCase();
  if (DISALLOWED_EXTENSIONS.some((ext) => pathname.endsWith(ext))) {
    return 'SVG 이미지는 업로드할 수 없습니다.';
  }

  return null;
}

function extractMarkdownImageUrls(markdown: string): string[] {
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = MARKDOWN_IMAGE_PATTERN.exec(markdown)) !== null) {
    if (match[1]) {
      urls.push(match[1]);
    }
  }
  return urls;
}

function extractHtmlImageUrls(html: string): string[] {
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return [];
  }
  const parser = new window.DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('img'))
    .map((img) => img.getAttribute('src') || '')
    .filter(Boolean);
}

export function validateContentSecurity(content: string, mode: ContentMode): string | null {
  if (!content || typeof content !== 'string') {
    return null;
  }

  const urls =
    mode === 'markdown' ? extractMarkdownImageUrls(content) : extractHtmlImageUrls(content);

  for (const url of urls) {
    const reason = getDisallowedReason(url);
    if (reason) {
      return reason;
    }
  }

  return null;
}

export function getAllowedImageHosts(): string[] {
  return Array.from(DEFAULT_ALLOWED_HOSTS);
}
