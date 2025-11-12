/**
 * 프론트엔드 URL 파라미터 안전 처리 유틸리티
 *
 * 백엔드 UrlSanitizerUtil과 유사한 기능을 제공하지만,
 * 프론트엔드 환경에 맞게 최적화됨
 */

// 허용되는 최대 길이
const MAX_PARAM_LENGTH = 255;

// 위험한 패턴 (Path Traversal, XSS 등)
const DANGEROUS_PATTERNS = [
  /\.\./g,  // 상위 디렉토리 접근
  /\//g,   // 경로 구분자
  /\\/g,   // Windows 경로 구분자
  /</g,    // HTML 태그 시작
  />/g,    // HTML 태그 끝
  /"/g,    // 큰따옴표
  /'/g,    // 작은따옴표
  /javascript:/gi,  // 자바스크립트 프로토콜
  /on\w+\s*=/gi,   // 이벤트 핸들러
];

/**
 * URL 파라미터 안전하게 디코딩
 * @param encoded - 인코딩된 문자열
 * @param options - 옵션 객체
 * @returns 디코딩된 문자열
 */
export function safeDecodeURIComponent(
  encoded: string,
  options: {
    maxLength?: number;
    allowHtml?: boolean;
    allowScripts?: boolean;
  } = {}
): string {
  if (!encoded) {
    return '';
  }

  const {
    maxLength = MAX_PARAM_LENGTH,
    allowHtml = false,
    allowScripts = false,
  } = options;

  // 길이 제한
  if (encoded.length > maxLength) {
    console.warn(`URL parameter too long: ${encoded.length} characters`);
    return encoded.substring(0, maxLength);
  }

  try {
    const decoded = decodeURIComponent(encoded);

    // 위험한 패턴 필터링
    if (!allowScripts && containsDangerousPatterns(decoded)) {
      console.warn(`Dangerous pattern detected in URL parameter: ${decoded.substring(0, 100)}...`);
      return sanitizeString(decoded, { allowHtml });
    }

    return decoded;
  } catch (error) {
    console.warn('Failed to decode URL parameter:', error, 'Input:', encoded.substring(0, 100));
    return encoded; // 실패 시 원본 반환 (서비스 중단 방지)
  }
}

/**
 * 슬러그 파라미터 정제
 * @param slug - 슬러그 문자열
 * @returns 정제된 슬러그
 */
export function sanitizeSlug(slug: string): string {
  if (!slug) {
    return '';
  }

  const sanitized = safeDecodeURIComponent(slug);

  // 허용되지 않는 문자 제거 (영문, 숫자, 하이픈, 언더스코어, 한글만 허용)
  return sanitized.replace(/[^a-zA-Z0-9가-힣\-_]/g, '');
}

/**
 * 검색어 등 사용자 입력 정제
 * @param input - 사용자 입력
 * @param options - 옵션
 * @returns 정제된 입력
 */
export function sanitizeUserInput(
  input: string,
  options: {
    allowHtml?: boolean;
    maxLength?: number;
  } = {}
): string {
  if (!input) {
    return '';
  }

  const { allowHtml = false, maxLength = MAX_PARAM_LENGTH } = options;
  let sanitized = safeDecodeURIComponent(input, { maxLength, allowScripts: false });

  if (!allowHtml) {
    // HTML 태그 제거
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // 스크립트 이벤트 핸들러 제거
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');

  // 자바스크립트 프로토콜 제거
  sanitized = sanitized.replace(/javascript:/gi, '');

  // 앞뒤 공백 제거
  sanitized = sanitized.trim();

  // 길이 제한
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * 이메일 주소 안전하게 디코딩
 * @param encodedEmail - 인코딩된 이메일
 * @returns 디코딩된 이메일
 */
export function safeDecodeEmail(encodedEmail: string): string {
  const decoded = safeDecodeURIComponent(encodedEmail);

  // 간단한 이메일 형식 검증
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(decoded)) {
    console.warn('Invalid email format:', decoded);
  }

  return decoded.toLowerCase(); // 이메일은 소문자로 통일
}

/**
 * 쿼리 파라미터에서 값을 안전하게 추출
 * @param searchParams - URLSearchParams 객체
 * @param key - 파라미터 키
 * @param options - 옵션
 * @returns 디코딩된 값 또는 null
 */
export function getSafeQueryParam(
  searchParams: URLSearchParams,
  key: string,
  options: {
    defaultValue?: string;
    sanitize?: boolean;
  } = {}
): string | null {
  const { defaultValue = null, sanitize = true } = options;

  const value = searchParams.get(key);
  if (!value) {
    return defaultValue;
  }

  if (sanitize) {
    return sanitizeUserInput(value);
  }

  return safeDecodeURIComponent(value);
}

/**
 * 위험한 패턴 포함 여부 확인
 * @param str - 검사할 문자열
 * @returns 위험한 패턴 포함 여부
 */
function containsDangerousPatterns(str: string): boolean {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(str));
}

/**
 * 문자열에서 위험한 문자 제거
 * @param str - 정제할 문자열
 * @param options - 옵션
 * @returns 정제된 문자열
 */
function sanitizeString(
  str: string,
  options: { allowHtml?: boolean } = {}
): string {
  const { allowHtml = false } = options;

  let sanitized = str;

  if (!allowHtml) {
    // HTML 꺽쇠 제거
    sanitized = sanitized.replace(/[<>]/g, '');
  }

  // 경로 구분자 제거
  sanitized = sanitized.replace(/[\/\\]/g, '');

  // 상위 디렉토리 참조 제거
  sanitized = sanitized.replace(/\.\./g, '');

  // 따옴표 제거
  sanitized = sanitized.replace(/['"]/g, '');

  return sanitized.trim();
}

/**
 * URL 파라미터 객체를 안전하게 파싱
 * @param params - URL 파라미터 객체
 * @param sanitizeOptions - 정제 옵션
 * @returns 정제된 파라미터 객체
 */
export function sanitizeUrlParams(
  params: Record<string, string>,
  sanitizeOptions?: {
    allowHtml?: boolean;
    maxLength?: number;
  }
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    sanitized[key] = sanitizeUserInput(value, sanitizeOptions);
  }

  return sanitized;
}

/**
 * 리다이렉트 URL 안전하게 검증
 * @param url - 검증할 URL
 * @param allowedDomains - 허용된 도메인 목록
 * @returns 안전한 URL 여부
 */
export function isSafeRedirectUrl(
  url: string,
  allowedDomains: string[] = [window.location.hostname]
): boolean {
  try {
    // 상대 경로는 항상 허용
    if (url.startsWith('/') && !url.startsWith('//')) {
      return true;
    }

    const parsedUrl = new URL(url);

    // 동일 출처 또는 허용된 도메인만 허용
    return allowedDomains.includes(parsedUrl.hostname);
  } catch {
    // URL 파싱 실패 시 불안전한 것으로 간주
    return false;
  }
}

/**
 * 메시지를 안전하게 디코딩하고 표시
 * @param encoded - 인코딩된 메시지
 * @param options - 옵션
 * @returns 디코딩된 메시지
 */
export function safeDecodeMessage(
  encoded: string,
  options: {
    maxLength?: number;
    allowHtml?: boolean;
  } = {}
): string {
  const { maxLength = 500, allowHtml = false } = options;

  let message = safeDecodeURIComponent(encoded, { maxLength, allowHtml });

  // 메시지는 일반적으로 짧으므로 길이 제한 더 엄격하게 적용
  if (message.length > maxLength) {
    message = message.substring(0, maxLength) + '...';
  }

  return message;
}