import { Injectable } from "@nestjs/common";
import { HtmlSanitizerService } from "./html-sanitizer.service";
import { CodeHighlightService } from "./code-highlight.service";
import { ImageProcessorService } from "./image-processor.service";

/**
 * 콘텐츠 처리 파이프라인 옵션
 */
export interface ContentProcessingOptions {
  /**
   * HTML 살균 활성화 여부
   */
  sanitize?: boolean;

  /**
   * iframe 허용 여부 (YouTube만)
   */
  allowIframes?: boolean;

  /**
   * HTML 주석 허용 여부 (Mermaid placeholder용)
   */
  allowComments?: boolean;

  /**
   * Mermaid 다이어그램 보존 여부
   */
  preserveMermaid?: boolean;

  /**
   * 코드 블록 처리 여부
   */
  processCode?: boolean;

  /**
   * 이미지 처리 여부
   */
  processImages?: boolean;

  /**
   * 이미지 URL 정규화시 사용할 기본 URL
   */
  baseUrl?: string;

  /**
   * 엄격한 살균 모드 (댓글 등에 사용)
   */
  strict?: boolean;

  /**
   * 텍스트만 추출 (HTML 태그 모두 제거)
   */
  textOnly?: boolean;
}

/**
 * 콘텐츠 처리 결과
 */
export interface ProcessedContent {
  /**
   * 처리된 HTML
   */
  html: string;

  /**
   * 메타데이터
   */
  metadata?: {
    /**
     * Mermaid 다이어그램 포함 여부
     */
    hasMermaid?: boolean;

    /**
     * 코드 블록 통계
     */
    codeStats?: {
      total: number;
      byLanguage: Record<string, number>;
      totalLines: number;
    };

    /**
     * 이미지 통계
     */
    imageStats?: {
      total: number;
      withCaption: number;
      formats: Record<string, number>;
    };

    /**
     * 사용된 프로그래밍 언어 목록
     */
    languages?: string[];

    /**
     * 이미지 URL 목록
     */
    imageUrls?: string[];
  };
}

/**
 * 콘텐츠 처리 서비스
 *
 * HTML 콘텐츠를 처리하는 메인 파이프라인 서비스입니다.
 * 모든 콘텐츠 처리 서비스를 조율하여 안전하고 최적화된 HTML을 생성합니다.
 */
@Injectable()
export class ContentProcessingService {
  constructor(
    private readonly htmlSanitizer: HtmlSanitizerService,
    private readonly codeHighlight: CodeHighlightService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  /**
   * HTML 콘텐츠를 처리합니다.
   *
   * @param html - 처리할 HTML 문자열
   * @param options - 처리 옵션
   * @returns 처리된 콘텐츠와 메타데이터
   */
  async process(
    html: string,
    options: ContentProcessingOptions = {},
  ): Promise<ProcessedContent> {
    const {
      sanitize = true,
      allowIframes = true,
      allowComments = true,
      preserveMermaid = true,
      processCode = true,
      processImages = true,
      baseUrl,
      strict = false,
      textOnly = false,
    } = options;

    // 빈 콘텐츠는 그대로 반환
    if (!html) {
      return { html: "", metadata: {} };
    }

    // 텍스트만 추출하는 경우
    if (textOnly) {
      const text = this.htmlSanitizer.extractText(html);
      return { html: text, metadata: {} };
    }

    // 엄격 모드인 경우 (댓글 등)
    if (strict) {
      const sanitized = this.htmlSanitizer.sanitizeStrict(html);
      return { html: sanitized, metadata: {} };
    }

    let processedHtml = html;
    const metadata: ProcessedContent["metadata"] = {};

    // 1단계: HTML 살균 (XSS 방지)
    if (sanitize) {
      processedHtml = this.htmlSanitizer.sanitize(processedHtml, {
        allowIframes,
        allowComments,
        preserveMermaid,
      });
    }

    // 2단계: 코드 블록 처리
    if (processCode) {
      processedHtml = this.codeHighlight.processCodeBlocks(processedHtml);

      // 코드 통계 수집
      const codeStats = this.codeHighlight.getCodeBlockStats(processedHtml);
      metadata.codeStats = {
        total: codeStats.total,
        byLanguage: codeStats.byLanguage,
        totalLines: codeStats.totalLines,
      };
      metadata.hasMermaid = codeStats.hasMermaid;

      // 사용된 언어 목록
      metadata.languages = this.codeHighlight.extractLanguages(processedHtml);
    }

    // 3단계: 이미지 처리
    if (processImages) {
      processedHtml = this.imageProcessor.processImages(processedHtml, baseUrl);

      // 이미지 통계 수집
      metadata.imageStats = this.imageProcessor.getImageStats(processedHtml);

      // 이미지 URL 목록
      metadata.imageUrls = this.imageProcessor.extractImageUrls(processedHtml);
    }

    // 4단계: YouTube iframe 크기 표준화 (685x540)
    processedHtml = this.standardizeYouTubeSize(processedHtml);

    return {
      html: processedHtml,
      metadata,
    };
  }

  /**
   * Markdown에서 변환된 HTML을 처리합니다.
   *
   * @param markdownHtml - Markdown에서 변환된 HTML
   * @param options - 처리 옵션
   * @returns 처리된 콘텐츠
   */
  async processMarkdownHtml(
    markdownHtml: string,
    options: ContentProcessingOptions = {},
  ): Promise<ProcessedContent> {
    // Markdown HTML은 기본적으로 모든 처리를 활성화
    return this.process(markdownHtml, {
      sanitize: true,
      allowIframes: true,
      allowComments: true,
      preserveMermaid: true,
      processCode: true,
      processImages: true,
      ...options,
    });
  }

  /**
   * 댓글 콘텐츠를 처리합니다.
   *
   * @param html - 댓글 HTML
   * @returns 처리된 댓글 콘텐츠
   */
  async processComment(html: string): Promise<ProcessedContent> {
    // 댓글은 엄격한 살균 적용
    return this.process(html, {
      strict: true,
    });
  }

  /**
   * 콘텐츠 미리보기를 생성합니다.
   *
   * @param html - HTML 문자열
   * @param maxLength - 최대 길이
   * @returns 텍스트 미리보기
   */
  generatePreview(html: string, maxLength = 200): string {
    const text = this.htmlSanitizer.extractText(html);

    if (text.length <= maxLength) {
      return text;
    }

    // 단어 경계에서 자르기
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  }

  /**
   * YouTube iframe 크기를 표준화합니다.
   *
   * @param html - HTML 문자열
   * @returns 크기가 표준화된 HTML
   */
  private standardizeYouTubeSize(html: string): string {
    if (!html) return "";

    // YouTube 컨테이너와 iframe 크기 조정
    return html.replace(
      /(<div[^>]*data-youtube-video[^>]*>)([\s\S]*?)(<iframe[^>]*>)/gi,
      (match: string, divStart: string, middle: string, iframeTag: string) => {
        // div 스타일 업데이트
        const updatedDiv = divStart.replace(
          /style="[^"]*"/,
          'style="position: relative; width: 685px; height: 540px; max-width: 100%; margin: 0 auto;"',
        );

        // iframe 크기 업데이트
        const updatedIframe = iframeTag
          .replace(/width="[^"]*"/gi, 'width="100%"')
          .replace(/height="[^"]*"/gi, 'height="100%"');

        return updatedDiv + middle + updatedIframe;
      },
    );
  }

  /**
   * 콘텐츠 검증을 수행합니다.
   *
   * @param html - 검증할 HTML
   * @returns 검증 결과
   */
  validateContent(html: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!html) {
      warnings.push("콘텐츠가 비어있습니다.");
      return { isValid: true, errors, warnings };
    }

    // 위험한 태그 검사
    if (/<script/i.test(html)) {
      errors.push("스크립트 태그가 포함되어 있습니다.");
    }

    if (/<style/i.test(html) && !/<style[^>]*scoped/i.test(html)) {
      warnings.push("전역 스타일 태그가 포함되어 있습니다.");
    }

    // iframe 검사 (YouTube 외)
    const iframeMatches = html.match(/<iframe[^>]*src="([^"]+)"/gi);
    if (iframeMatches) {
      iframeMatches.forEach((match) => {
        const srcMatch = match.match(/src="([^"]+)"/i);
        if (srcMatch && srcMatch[1]) {
          const src = srcMatch[1];
          if (!this.isYouTubeUrl(src)) {
            warnings.push(`YouTube가 아닌 iframe이 포함되어 있습니다: ${src}`);
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * URL이 YouTube URL인지 확인합니다.
   *
   * @param url - 확인할 URL
   * @returns YouTube URL 여부
   */
  private isYouTubeUrl(url: string): boolean {
    if (!url) return false;

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      return (
        hostname === "www.youtube.com" ||
        hostname === "youtube.com" ||
        hostname === "youtu.be" ||
        hostname === "www.youtube-nocookie.com"
      );
    } catch {
      return false;
    }
  }
}
