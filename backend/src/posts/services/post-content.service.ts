import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { MarkdownRendererService } from "../../common/services/markdown-renderer.service";
import { ContentProcessingService } from "../../content-processing/services/content-processing.service";

/**
 * 포스트 콘텐츠 처리 서비스
 *
 * 책임:
 * - 마크다운 콘텐츠 처리 및 렌더링
 * - 썸네일 추출
 * - 콘텐츠 포맷 변환
 * - 이미지 URL 최적화
 */
@Injectable()
export class PostContentService {
  private readonly logger = new Logger(PostContentService.name);

  constructor(
    private readonly markdownRenderer: MarkdownRendererService,
    private readonly contentProcessing: ContentProcessingService,
  ) {}

  /**
   * 마크다운 콘텐츠를 HTML로 변환하고 처리
   *
   * @param content 원본 콘텐츠 (마크다운 또는 HTML)
   * @param options 처리 옵션
   * @returns 처리된 콘텐츠 정보
   */
  async processContent(
    content: string,
    options?: {
      preserveMermaid?: boolean;
      sanitize?: boolean;
      processCode?: boolean;
      processImages?: boolean;
    },
  ): Promise<{
    html: string;
    markdown?: string;
    isMarkdown: boolean;
  }> {
    // 마크다운 여부 확인
    const isMarkdown = this.isMarkdownContent(content);

    let htmlContent: string;
    let markdownContent: string | undefined;

    if (isMarkdown) {
      // 마크다운을 HTML로 변환
      htmlContent = this.markdownRenderer.convertToHtml(content);
      markdownContent = content;
    } else {
      // 이미 HTML인 경우 그대로 사용
      htmlContent = content;
    }

    // 백엔드에서 콘텐츠 처리 파이프라인 적용
    const processed = await this.contentProcessing.processMarkdownHtml(
      htmlContent,
      {
        sanitize: options?.sanitize ?? true,
        processCode: options?.processCode ?? true,
        processImages: options?.processImages ?? true,
        preserveMermaid: options?.preserveMermaid ?? true,
      },
    );

    return {
      html: processed.html,
      markdown: markdownContent,
      isMarkdown,
    };
  }

  /**
   * 썸네일을 콘텐츠에서 추출
   *
   * @param content HTML 콘텐츠
   * @param explicitThumbnail 명시적으로 제공된 썸네일 URL
   * @returns 썸네일 URL
   */
  extractThumbnail(content: string, explicitThumbnail?: string): string | null {
    // 명시적으로 제공된 썸네일이 있으면 우선 사용
    if (explicitThumbnail !== undefined) {
      return explicitThumbnail;
    }

    // 콘텐츠에서 첫 번째 이미지 추출
    return this.extractThumbnailFromContent(content);
  }

  /**
   * 마크다운 여부 확인
   *
   * @param content 콘텐츠
   * @returns 마크다운 여부
   */
  isMarkdownContent(content: string): boolean {
    if (!content) return false;

    // 마크다운 패턴 검사
    const markdownPatterns = [
      /^#{1,6}\s+/m, // 헤딩
      /\*\*.*\*\*/, // 굵은 글씨
      /\*.*\*/, // 기울임
      /^\s*[-*+]\s+/m, // 리스트
      /^\s*\d+\.\s+/m, // 번호 리스트
      /```[\s\S]*?```/, // 코드 블록
      /`[^`]+`/, // 인라인 코드
      /\[.*?\]\(.*?\)/, // 링크
      /!\[.*?\]\(.*?\)/, // 이미지
      /^---$/m, // 수평선
      /^>\s+/m, // 인용문
    ];

    return markdownPatterns.some((pattern) => pattern.test(content));
  }

  /**
   * HTML 콘텐츠에서 썸네일 URL 추출
   *
   * @param content HTML 콘텐츠
   * @returns 첫 번째 이미지 URL 또는 null
   */
  private extractThumbnailFromContent(content: string): string | null {
    if (!content) return null;

    // HTML에서 첫 번째 img 태그의 src 추출
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = content.match(imgRegex);

    if (match && match[1]) {
      return match[1];
    }

    return null;
  }

  /**
   * 포스트의 마크다운 콘텐츠 재렌더링
   *
   * @param postId 포스트 ID
   * @param markdownContent 마크다운 콘텐츠
   * @returns 처리된 HTML 콘텐츠
   */
  async rerenderMarkdown(
    postId: string,
    markdownContent: string,
  ): Promise<{
    html: string;
    thumbnail: string | null;
  }> {
    if (!markdownContent) {
      throw new NotFoundException("Post with markdown content not found");
    }

    this.logger.log(
      `[Rerender] Starting markdown rerender for post: ${postId}`,
    );

    // 마크다운을 HTML로 변환
    const htmlContent = this.markdownRenderer.convertToHtml(markdownContent);

    // 콘텐츠 처리 파이프라인 적용
    const processed = await this.contentProcessing.processMarkdownHtml(
      htmlContent,
      {
        sanitize: true,
        processCode: true,
        processImages: true,
        preserveMermaid: true,
      },
    );

    // 썸네일 추출
    const thumbnail = this.extractThumbnail(processed.html);

    this.logger.log(
      `[Rerender] Completed markdown rerender for post: ${postId}, thumbnail: ${thumbnail}`,
    );

    return {
      html: processed.html,
      thumbnail,
    };
  }

  /**
   * 이미지 URL 최적화
   *
   * @param url 이미지 URL
   * @returns 최적화된 URL
   */
  optimizeImageUrl(url: string | null): string | null {
    // 빠른 실패: null 체크
    if (!url) return null;

    // 빠른 실패: YouTube 썸네일은 YouTube CDN 활용
    if (url.indexOf("youtube.com") !== -1 || url.indexOf("ytimg.com") !== -1) {
      return url;
    }

    // 외부 HTTP/HTTPS URL은 그대로 반환
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }

    // S3 키 (uploads/, v2/ 등)는 원본 URL 반환 (CDN 일시적으로 비활성화)
    if (url.startsWith("uploads/") || url.startsWith("v2/")) {
      return url;
    }

    return url;
  }

  /**
   * 콘텐츠에서 요약문(excerpt) 추출
   *
   * @param content 콘텐츠
   * @param maxLength 최대 길이
   * @returns 요약문
   */
  extractExcerpt(content: string, maxLength: number = 150): string {
    if (!content) return "";

    // 마크다운 이미지 문법 제거 (![alt text](url) 형식)
    // 이미지 파일명이 excerpt에 노출되지 않도록 처리
    const contentWithoutImages = content
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, "") // 마크다운 이미지 완전 제거
      .replace(/!\[[^\]]*\]/g, ""); // 이미지 참조 형식도 제거

    // 마크다운 문법 제거 (본문은 유지, excerpt만 텍스트화)
    const withoutMarkdown = contentWithoutImages
      .replace(/`{1,3}[^`]*`{1,3}/g, "") // 인라인/블록 코드
      .replace(/!\[[^\]]*]\([^)]*\)/g, "") // 이미지
      .replace(/\[[^\]]*]\([^)]*\)/g, "$1") // 링크 텍스트만
      .replace(/[*_~]{1,3}/g, "") // 강조/취소선
      .replace(/^\s{0,3}#{1,6}\s+/gm, "") // 헤딩
      .replace(/^\s{0,3}>\s?/gm, "") // 인용
      .replace(/^\s{0,3}[-*+]\s+/gm, "") // 불릿 리스트
      .replace(/^\s{0,3}\d+\.\s+/gm, ""); // 번호 리스트

    // HTML 태그 제거
    const textContent = withoutMarkdown
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 길이 제한
    if (textContent.length <= maxLength) {
      return textContent;
    }

    // 단어 중간에서 잘리지 않도록 처리
    const truncated = textContent.substring(0, maxLength);
    const lastSpaceIndex = truncated.lastIndexOf(" ");

    if (lastSpaceIndex > maxLength * 0.8) {
      return truncated.substring(0, lastSpaceIndex) + "...";
    }

    return truncated + "...";
  }

  /**
   * 콘텐츠 글자 수 계산 (HTML 태그 제외)
   *
   * @param content 콘텐츠
   * @returns 글자 수
   */
  calculateReadingTime(content: string): {
    wordCount: number;
    readingTimeMinutes: number;
  } {
    if (!content) {
      return { wordCount: 0, readingTimeMinutes: 0 };
    }

    // HTML 태그 제거 및 공백 정리
    const textContent = content
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // 단어 수 계산 (영어: 공백 기준, 한글: 문자 기준)
    const englishWords = textContent
      .split(/\s+/)
      .filter((word) => /[a-zA-Z]/.test(word)).length;
    const koreanChars = textContent.replace(/[a-zA-Z\s]/g, "").length;
    const koreanWords = Math.ceil(koreanChars / 2); // 한글은 2글자를 1단어로 간주

    const totalWords = englishWords + koreanWords;
    const readingTimeMinutes = Math.ceil(totalWords / 200); // 분당 200단어 읽기 속도 가정

    return {
      wordCount: totalWords,
      readingTimeMinutes,
    };
  }
}
