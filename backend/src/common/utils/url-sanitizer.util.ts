import { Logger } from "@nestjs/common";

/**
 * URL 파라미터 안전 처리 유틸리티
 *
 * 목적:
 * - URL 인코딩된 문자열 안전하게 디코딩
 * - 악의적인 입력값 필터링 및 정제
 * - Path Traversal, URL Injection 등 보안 위협 방어
 */
export class UrlSanitizerUtil {
  private static readonly logger = new Logger(UrlSanitizerUtil.name);

  // 허용되는 최대 길이
  private static readonly MAX_PARAM_LENGTH = 255;

  // 슬러그 허용 패턴 (영문, 숫자, 하이픈, 언더스코어, 한글)
  private static readonly SLUG_PATTERN = /^[a-zA-Z0-9가-힣\-_]+$/;

  // 파일명 허용 패턴 (확장자 포함)
  private static readonly FILENAME_PATTERN = /^[a-zA-Z0-9가-힣\-_\.]+$/;

  // 위험한 패턴 (Path Traversal, Directory Traversal 등)
  private static readonly DANGEROUS_PATTERNS = [
    /\.\./, // 상위 디렉토리 접근
    /\//, // 경로 구분자
    /\\/, // Windows 경로 구분자
    /%2e%2e/i, // URL 인코딩된 ../
    /%2f/i, // URL 인코딩된 /
    /%5c/i, // URL 인코딩된 \
  ];

  /**
   * URL 파라미터 안전하게 디코딩
   * @param encoded - 인코딩된 문자열
   * @returns 디코딩된 문자열 (실패 시 원본 반환)
   */
  static safeDecodeURIComponent(encoded: string): string {
    if (!encoded) {
      return "";
    }

    // 길이 검증
    if (encoded.length > this.MAX_PARAM_LENGTH) {
      this.logger.warn(`URL parameter too long: ${encoded.length} characters`);
      return encoded.substring(0, this.MAX_PARAM_LENGTH);
    }

    try {
      const decoded = decodeURIComponent(encoded);

      // 위험한 패턴 검사
      if (this.containsDangerousPatterns(decoded)) {
        this.logger.warn(
          `Dangerous pattern detected in URL parameter: ${decoded}`,
        );
        return this.sanitizeString(decoded);
      }

      return decoded;
    } catch (error) {
      this.logger.warn(`Failed to decode URL parameter: ${encoded}`, error);
      return encoded; // 실패 시 원본 반환 (서비스 중단 방지)
    }
  }

  /**
   * 슬러그 파라미터 정제
   * @param slug - 슬러그 문자열
   * @returns 정제된 슬러그
   */
  static sanitizeSlug(slug: string): string {
    if (!slug) {
      return "";
    }

    const sanitized = this.safeDecodeURIComponent(slug);

    // 슬러그 패턴 검증
    if (!this.SLUG_PATTERN.test(sanitized)) {
      this.logger.warn(`Invalid slug format: ${sanitized}`);
      // 허용되지 않는 문자 제거
      return sanitized.replace(/[^a-zA-Z0-9가-힣\-_]/g, "");
    }

    return sanitized;
  }

  /**
   * 파일 경로 파라미터 정제
   * @param path - 파일 경로
   * @returns 정제된 파일 경로
   */
  static sanitizeFilePath(path: string): string {
    if (!path) {
      return "";
    }

    const sanitized = this.safeDecodeURIComponent(path);

    // 파일명 패턴 검증 및 정제
    const filename = sanitized.split("/").pop() || "";
    if (!this.FILENAME_PATTERN.test(filename)) {
      this.logger.warn(`Invalid filename format: ${filename}`);
      // 안전한 파일명으로 대체
      const timestamp = Date.now();
      return `file_${timestamp}`;
    }

    // 경로 구분자 제거 (파일명만 반환)
    return filename;
  }

  /**
   * 일반적인 경로 파라미터 정제
   * @param param - 경로 파라미터
   * @returns 정제된 파라미터
   */
  static sanitizePathParam(param: string): string {
    if (!param) {
      return "";
    }

    const sanitized = this.safeDecodeURIComponent(param);

    // 위험한 패턴 제거
    if (this.containsDangerousPatterns(sanitized)) {
      this.logger.warn(`Dangerous pattern in path param: ${sanitized}`);
      return this.sanitizeString(sanitized);
    }

    return sanitized;
  }

  /**
   * 검색어 등 사용자 입력 정제
   * @param input - 사용자 입력
   * @returns 정제된 입력
   */
  static sanitizeUserInput(input: string): string {
    if (!input) {
      return "";
    }

    let sanitized = this.stripDangerousContent(input);

    // 길이 제한
    if (sanitized.length > this.MAX_PARAM_LENGTH) {
      sanitized = sanitized.substring(0, this.MAX_PARAM_LENGTH);
    }

    return sanitized.trim();
  }

  /**
   * 화면 표시에 사용할 텍스트 정제 (길이 제한 완화)
   * @param input - 사용자 입력
   * @param maxLength - 허용할 최대 길이 (기본 5000)
   */
  static sanitizeDisplayText(input: string, maxLength: number = 5000): string {
    if (!input) {
      return "";
    }

    let sanitized = this.stripDangerousContent(input);

    if (maxLength > 0 && sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized.trim();
  }

  /**
   * 위험한 패턴 포함 여부 확인
   * @param str - 검사할 문자열
   * @returns 위험한 패턴 포함 여부
   */
  private static containsDangerousPatterns(str: string): boolean {
    return this.DANGEROUS_PATTERNS.some((pattern) => pattern.test(str));
  }

  private static stripDangerousContent(value: string): string {
    let sanitized = value.replace(/<[^>]*>/g, "");
    sanitized = sanitized.replace(/on\w+\s*=/gi, "");
    sanitized = sanitized.replace(/javascript:/gi, "");
    return sanitized;
  }

  /**
   * 문자열에서 위험한 문자 제거
   * @param str - 정제할 문자열
   * @returns 정제된 문자열
   */
  private static sanitizeString(str: string): string {
    return str
      .replace(/[\/\\]/g, "") // 경로 구분자 제거
      .replace(/\.\./g, "") // 상위 디렉토리 참조 제거
      .replace(/[<>]/g, "") // HTML 태그 꺽쇠 제거
      .trim();
  }

  /**
   * URL 전체의 유효성 검증
   * @param url - 검증할 URL
   * @returns 유효한 URL 여부
   */
  static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 이메일 주소 안전하게 디코딩
   * @param encodedEmail - 인코딩된 이메일
   * @returns 디코딩된 이메일
   */
  static safeDecodeEmail(encodedEmail: string): string {
    const decoded = this.safeDecodeURIComponent(encodedEmail);

    // 간단한 이메일 형식 검증
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(decoded)) {
      this.logger.warn(`Invalid email format: ${decoded}`);
    }

    return decoded;
  }
}
