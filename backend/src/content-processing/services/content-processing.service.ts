import { Injectable, Logger } from "@nestjs/common";
import { JSDOM } from "jsdom";
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
  private readonly logger = new Logger(ContentProcessingService.name);

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

    // 4단계: YouTube 임베드 보강 + 크기 표준화 (685x540)
    processedHtml = this.ensureYouTubeEmbeds(processedHtml);
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
   * YouTube 임베드를 보강합니다.
   *
   * - data-youtube-video 컨테이너에 iframe이 없으면 복구
   * - 단독 YouTube 링크를 임베드로 변환
   */
  private ensureYouTubeEmbeds(html: string): string {
    if (!html) return "";
    if (!/youtube\.com|youtu\.be|data-youtube-video/i.test(html)) {
      return html;
    }

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;
      const { Node } = dom.window;

      // 1) data-youtube-video 컨테이너 복구
      const wrappers = Array.from(
        document.querySelectorAll("div[data-youtube-video]"),
      );

      wrappers.forEach((wrapper) => {
        const existingIframe = wrapper.querySelector("iframe");
        const iframeSrc = existingIframe?.getAttribute("src") || "";
        if (this.extractYouTubeVideoId(iframeSrc)) {
          return;
        }

        const candidateUrl =
          wrapper.getAttribute("data-original-url") ||
          (wrapper.textContent || "").trim();
        const videoId = this.extractYouTubeVideoId(candidateUrl);
        if (!videoId) return;

        wrapper.textContent = "";
        const embed = this.buildYouTubeEmbedElement(
          document,
          videoId,
          candidateUrl,
        );
        wrapper.replaceWith(embed);
      });

      // 2) 단독 YouTube 링크 처리
      const paragraphs = Array.from(document.querySelectorAll("p"));
      paragraphs.forEach((element) => {
        const parentTag = element.parentElement?.tagName || "";
        if (["LI", "BLOCKQUOTE", "PRE", "CODE"].includes(parentTag)) {
          return;
        }

        const url = this.extractStandaloneUrl(element, Node);
        if (!url) return;
        const videoId = this.extractYouTubeVideoId(url);
        if (!videoId) return;

        const embed = this.buildYouTubeEmbedElement(document, videoId, url);
        element.replaceWith(embed);
      });

      return document.body.innerHTML;
    } catch (error) {
      this.logger.warn(
        "[ContentProcessing] Failed to ensure YouTube embeds:",
        error,
      );
      return html;
    }
  }

  private extractStandaloneUrl(
    element: Element,
    NodeRef: { TEXT_NODE: number; ELEMENT_NODE: number },
  ): string | null {
    const nonWhitespaceNodes = Array.from(element.childNodes).filter((node) => {
      if (node.nodeType === NodeRef.TEXT_NODE) {
        return (node.textContent || "").trim().length > 0;
      }
      return true;
    });

    if (nonWhitespaceNodes.length === 1) {
      const node = nonWhitespaceNodes[0];
      if (node.nodeType === NodeRef.TEXT_NODE) {
        const text = (node.textContent || "").trim();
        return text || null;
      }

      if (
        node.nodeType === NodeRef.ELEMENT_NODE &&
        (node as Element).tagName === "A"
      ) {
        const anchor = node as HTMLAnchorElement;
        const href = anchor.getAttribute("href")?.trim();
        return href || (anchor.textContent || "").trim() || null;
      }
    }

    return null;
  }

  private buildYouTubeEmbedElement(
    document: Document,
    videoId: string,
    originalUrl: string,
  ): HTMLElement {
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-youtube-video", "true");
    wrapper.setAttribute("data-original-url", originalUrl);
    wrapper.setAttribute(
      "style",
      "position: relative; width: 685px; height: 540px; max-width: 100%; margin: 0 auto;",
    );

    const iframe = document.createElement("iframe");
    iframe.setAttribute("src", `https://www.youtube.com/embed/${videoId}`);
    iframe.setAttribute("width", "100%");
    iframe.setAttribute("height", "100%");
    iframe.setAttribute("frameborder", "0");
    iframe.setAttribute("allowfullscreen", "true");
    iframe.setAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    iframe.setAttribute(
      "style",
      "position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;",
    );

    wrapper.appendChild(iframe);
    return wrapper;
  }

  private extractYouTubeVideoId(url: string): string | null {
    if (!url) return null;

    const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;

    try {
      const parsed = new URL(normalizedUrl);
      const host = parsed.hostname.toLowerCase();

      const isYouTubeHost =
        host === "youtube.com" ||
        host === "www.youtube.com" ||
        host === "m.youtube.com" ||
        host === "music.youtube.com" ||
        host === "youtu.be" ||
        host === "www.youtu.be" ||
        host === "youtube-nocookie.com" ||
        host === "www.youtube-nocookie.com";

      if (!isYouTubeHost) return null;

      if (host.includes("youtu.be")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[1]);
      }

      if (parsed.pathname.startsWith("/watch")) {
        return this.normalizeYouTubeId(parsed.searchParams.get("v"));
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[2]);
      }

      if (parsed.pathname.startsWith("/embed/")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[2]);
      }

      if (parsed.pathname.startsWith("/v/")) {
        return this.normalizeYouTubeId(parsed.pathname.split("/")[2]);
      }

      return null;
    } catch {
      const fallbackMatch = url.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
      );
      return fallbackMatch?.[1] || null;
    }
  }

  private normalizeYouTubeId(value: string | null | undefined): string | null {
    if (!value) return null;
    const match = value.match(/[a-zA-Z0-9_-]{11}/);
    return match ? match[0] : null;
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
