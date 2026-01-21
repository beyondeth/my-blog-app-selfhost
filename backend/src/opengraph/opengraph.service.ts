import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { OpenGraphResponseDto } from "./dto/opengraph.dto";
import { CacheService, CacheTTL } from "../cache/cache.service";
import { UrlSafetyService } from "../common/services/url-safety.service";

/**
 * Open Graph 메타데이터 서비스
 *
 * @description
 * URL에서 Open Graph 메타데이터를 추출하여 링크 카드 표시에 사용합니다.
 *
 * **특징:**
 * - HTML 파싱으로 og:* 메타 태그 추출
 * - 폴백: title, meta description 사용
 * - Redis 캐싱 (24시간)
 * - 타임아웃 및 에러 핸들링
 */
@Injectable()
export class OpenGraphService {
  private readonly logger = new Logger(OpenGraphService.name);

  /** 요청 타임아웃 (5초) */
  private readonly REQUEST_TIMEOUT = 5000;

  /** 최대 응답 크기 (500KB) */
  private readonly MAX_RESPONSE_SIZE = 500 * 1024;

  /** 캐시 키 접두사 */
  private readonly CACHE_KEY_PREFIX = "og:";

  constructor(
    private readonly cacheService: CacheService,
    private readonly urlSafetyService: UrlSafetyService,
  ) {}

  /**
   * URL에서 Open Graph 메타데이터 추출
   *
   * @param url 대상 URL
   * @returns Open Graph 메타데이터
   *
   * @example
   * ```typescript
   * const og = await fetchOpenGraph('https://github.com/user/repo');
   * // {
   * //   url: 'https://github.com/user/repo',
   * //   title: 'user/repo',
   * //   description: 'Repository description...',
   * //   imageUrl: 'https://opengraph.githubassets.com/...',
   * //   siteName: 'GitHub',
   * //   domain: 'github.com',
   * //   success: true
   * // }
   * ```
   */
  async fetchOpenGraph(url: string): Promise<OpenGraphResponseDto> {
    // URL 정규화
    let normalizedUrl: string;
    try {
      normalizedUrl = await this.urlSafetyService.normalizeAndValidate(url);
    } catch (error) {
      const domain = this.extractDomain(url);
      const message =
        error instanceof BadRequestException
          ? error.message
          : "유효하지 않거나 접근할 수 없는 URL입니다.";
      return this.createErrorResponse(url, domain, message);
    }

    // 캐시 확인
    const cacheKey = this.getCacheKey(normalizedUrl);
    const cached = await this.cacheService.get<OpenGraphResponseDto>(cacheKey);
    if (cached) {
      this.logger.debug(`[OpenGraph] Cache hit: ${normalizedUrl}`);
      return cached;
    }

    try {
      // URL에서 도메인 추출
      const urlObj = new URL(normalizedUrl);
      const domain = urlObj.hostname.replace("www.", "");

      // HTML 가져오기
      const html = await this.fetchHtml(normalizedUrl);

      if (!html) {
        return this.createErrorResponse(
          normalizedUrl,
          domain,
          "페이지를 가져올 수 없습니다.",
        );
      }

      // 메타데이터 추출
      const metadata = this.extractMetadata(html, normalizedUrl, domain);

      // 캐시 저장 (24시간)
      await this.cacheService.set(cacheKey, metadata, CacheTTL.LONG);

      this.logger.debug(
        `[OpenGraph] Fetched: ${normalizedUrl} - ${metadata.title}`,
      );
      return metadata;
    } catch (error) {
      this.logger.warn(
        `[OpenGraph] Error fetching ${normalizedUrl}:`,
        error.message,
      );
      const domain = this.extractDomain(normalizedUrl);
      return this.createErrorResponse(normalizedUrl, domain, error.message);
    }
  }

  /**
   * 캐시 키 생성
   */
  private getCacheKey(url: string): string {
    // URL을 해시하여 캐시 키 생성
    const hash = Buffer.from(url)
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "");
    return `${this.CACHE_KEY_PREFIX}${hash.substring(0, 64)}`;
  }

  /**
   * HTML 가져오기
   */
  private async fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.REQUEST_TIMEOUT,
    );

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; OpenGraphBot/1.0; +https://blog.example.com)",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        this.logger.debug(`[OpenGraph] HTTP ${response.status}: ${url}`);
        return null;
      }

      // Content-Type 확인
      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("application/xhtml")
      ) {
        this.logger.debug(`[OpenGraph] Not HTML: ${contentType}`);
        return null;
      }

      // 크기 제한 확인
      const contentLength = response.headers.get("content-length");
      if (
        contentLength &&
        parseInt(contentLength, 10) > this.MAX_RESPONSE_SIZE
      ) {
        this.logger.debug(`[OpenGraph] Too large: ${contentLength} bytes`);
        return null;
      }

      const text = await response.text();
      return text.substring(0, this.MAX_RESPONSE_SIZE);
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        this.logger.debug(`[OpenGraph] Timeout: ${url}`);
      }
      return null;
    }
  }

  /**
   * HTML에서 메타데이터 추출
   */
  private extractMetadata(
    html: string,
    url: string,
    domain: string,
  ): OpenGraphResponseDto {
    const result: OpenGraphResponseDto = {
      url,
      domain,
      success: true,
    };

    // Open Graph 메타 태그 추출
    result.title =
      this.extractMetaContent(html, "og:title") ||
      this.extractMetaContent(html, "twitter:title") ||
      this.extractTitle(html);

    result.description =
      this.extractMetaContent(html, "og:description") ||
      this.extractMetaContent(html, "twitter:description") ||
      this.extractMetaContent(html, "description");

    result.imageUrl =
      this.extractMetaContent(html, "og:image") ||
      this.extractMetaContent(html, "twitter:image");

    result.siteName =
      this.extractMetaContent(html, "og:site_name") ||
      this.extractMetaContent(html, "application-name");

    result.type = this.extractMetaContent(html, "og:type");

    // 파비콘 URL 추출
    result.faviconUrl = this.extractFavicon(html, url);

    // 상대 URL을 절대 URL로 변환
    if (result.imageUrl && !result.imageUrl.startsWith("http")) {
      try {
        result.imageUrl = new URL(result.imageUrl, url).href;
      } catch {
        // URL 변환 실패 시 그대로 유지
      }
    }

    return result;
  }

  /**
   * 메타 태그 content 추출
   */
  private extractMetaContent(
    html: string,
    property: string,
  ): string | undefined {
    // og:*, twitter:* 메타 태그
    const ogRegex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']`,
      "i",
    );
    let match = html.match(ogRegex);

    if (!match) {
      // content가 먼저 오는 경우
      const reverseRegex = new RegExp(
        `<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
        "i",
      );
      match = html.match(reverseRegex);
    }

    return match?.[1]?.trim() || undefined;
  }

  /**
   * title 태그 추출
   */
  private extractTitle(html: string): string | undefined {
    const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    return match?.[1]?.trim() || undefined;
  }

  /**
   * 파비콘 URL 추출
   */
  private extractFavicon(html: string, baseUrl: string): string | undefined {
    // link[rel="icon"] 또는 link[rel="shortcut icon"]
    const iconMatch = html.match(
      /<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']*)["']/i,
    );

    if (iconMatch?.[1]) {
      try {
        return new URL(iconMatch[1], baseUrl).href;
      } catch {
        return iconMatch[1];
      }
    }

    // 기본 /favicon.ico 시도
    try {
      return new URL("/favicon.ico", baseUrl).href;
    } catch {
      return undefined;
    }
  }

  /**
   * URL에서 도메인 추출
   */
  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return "";
    }
  }

  /**
   * 에러 응답 생성
   */
  private createErrorResponse(
    url: string,
    domain: string,
    error: string,
  ): OpenGraphResponseDto {
    return {
      url,
      domain,
      success: false,
      error,
    };
  }
}
