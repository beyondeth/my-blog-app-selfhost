import { Injectable } from '@nestjs/common';
import * as DOMPurify from 'isomorphic-dompurify';
import * as sanitizeHtml from 'sanitize-html';

/**
 * HTML Sanitizer 서비스
 *
 * HTML 콘텐츠를 안전하게 살균(sanitize)하는 서비스입니다.
 * XSS 공격을 방지하면서도 필요한 HTML 태그와 속성은 보존합니다.
 */
@Injectable()
export class HtmlSanitizerService {
  /**
   * DOMPurify 설정 옵션
   *
   * 허용되는 태그와 속성을 정의합니다.
   * YouTube iframe과 Mermaid 다이어그램을 지원하면서도 보안을 유지합니다.
   */
  private readonly domPurifyConfig = {
    ALLOWED_TAGS: [
      // 텍스트 포맷팅
      'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'sub', 'sup', 'del', 'ins',
      // 제목
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // 리스트
      'ul', 'ol', 'li',
      // 인용
      'blockquote',
      // 링크
      'a',
      // 이미지
      'img',
      // 코드
      'code', 'pre', 'span', 'kbd', 'samp', 'var',
      // 컨테이너
      'div',
      // 구분선
      'hr',
      // 테이블
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
      // 버튼 (코드 복사 버튼용)
      'button',
      // 주석 (Mermaid placeholder용)
      '#comment',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'target', 'rel',
      'data-*', // 데이터 속성
      'width', 'height',
      'class', 'style', // 스타일링
      'id', // 요소 식별
      // 이미지 최적화
      'loading', 'decoding',
    ],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    ALLOW_COMMENTS: true, // Mermaid placeholder 주석 허용
  };

  /**
   * sanitize-html 설정 옵션 (백업 옵션)
   *
   * DOMPurify가 사용 불가능한 경우 사용됩니다.
   */
  private readonly sanitizeHtmlConfig = {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'u', 's', 'mark', 'sub', 'sup', 'del', 'ins',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote',
      'a',
      'img',
      'code', 'pre', 'span', 'kbd', 'samp', 'var',
      'div',
      'hr',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
      'button',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'data-*', 'id'],
      'a': ['href', 'target', 'rel', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      'button': ['data-code'],
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowCommentTag: true,
  };

  /**
   * HTML 콘텐츠를 살균합니다.
   *
   * @param html - 살균할 HTML 문자열
   * @param options - 추가 옵션
   * @returns 살균된 HTML 문자열
   */
  sanitize(
    html: string,
    options?: {
      allowIframes?: boolean;
      allowComments?: boolean;
      preserveMermaid?: boolean;
    },
  ): string {
    if (!html) return '';

    const {
      allowIframes = true,
      allowComments = true,
      preserveMermaid = true,
    } = options || {};

    try {
      // Mermaid 코드 블록 보존
      let processedHtml = html;
      const mermaidBlocks: { placeholder: string; content: string }[] = [];

      if (preserveMermaid) {
        // Mermaid 코드 블록을 임시 플레이스홀더로 교체
        // data-language 속성이 있는 경우도 지원 (code-highlight.service.ts와 호환)
        processedHtml = processedHtml.replace(
          /<pre[^>]*><code[^>]*class="[^"]*language-mermaid[^"]*"[^>]*>([\s\S]*?)<\/code><\/pre>/gi,
          (match, content) => {
            const placeholder = `<!--MERMAID_BLOCK_${mermaidBlocks.length}-->`;
            mermaidBlocks.push({ placeholder, content });
            return placeholder;
          },
        );
      }

      // DOMPurify로 살균
      const config = { ...this.domPurifyConfig };

      if (!allowComments) {
        config.ALLOW_COMMENTS = false;
      }

      let sanitized = DOMPurify.sanitize(processedHtml, config);

      // Mermaid 블록 복원
      if (preserveMermaid) {
        mermaidBlocks.forEach(({ placeholder, content }) => {
          // Mermaid 콘텐츠 전처리 및 살균
          let sanitizedContent = this.sanitizeMermaidContent(content);
          sanitized = sanitized.replace(
            placeholder,
            `<pre><code class="language-mermaid">${sanitizedContent}</code></pre>`,
          );
        });
      }

      return sanitized;
    } catch (error) {
      console.error('DOMPurify sanitization failed, falling back to sanitize-html:', error);

      // Fallback to sanitize-html
      return this.fallbackSanitize(html, options);
    }
  }

  /**
   * sanitize-html을 사용한 폴백 살균
   *
   * DOMPurify가 실패한 경우 사용됩니다.
   */
  private fallbackSanitize(
    html: string,
    options?: {
      allowIframes?: boolean;
      allowComments?: boolean;
      preserveMermaid?: boolean;
    },
  ): string {
    const { allowIframes = true, allowComments = true } = options || {};

    const config = { ...this.sanitizeHtmlConfig };

    if (!allowComments) {
      config.allowCommentTag = false;
    }

    return sanitizeHtml(html, config);
  }

  /**
   * 특정 태그만 허용하는 엄격한 살균
   *
   * 댓글이나 제한된 콘텐츠에 사용됩니다.
   */
  sanitizeStrict(html: string): string {
    if (!html) return '';

    const strictConfig = {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a', 'code'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOWED_URI_REGEXP: /^https?:\/\//i,
    };

    return DOMPurify.sanitize(html, strictConfig);
  }

  /**
   * 텍스트만 추출 (모든 HTML 태그 제거)
   *
   * 미리보기나 검색 인덱싱에 사용됩니다.
   */
  extractText(html: string): string {
    if (!html) return '';

    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  }

  /**
   * Mermaid 콘텐츠를 안전하게 살균합니다.
   *
   * Mermaid 다이어그램은 특별한 구문을 사용하므로, HTML 태그를 적절히 처리합니다.
   * - <br>, <br/> 태그를 Mermaid 라인 브레이크(\n)로 변환
   * - HTML 엔티티 디코딩
   * - 위험한 스크립트 태그 제거
   *
   * @param content - Mermaid 원본 콘텐츠
   * @returns 살균된 Mermaid 콘텐츠
   */
  private sanitizeMermaidContent(content: string): string {
    if (!content) return '';

    try {
      // 1. HTML 엔티티 디코딩 (백엔드에서 인코딩된 경우)
      let processed = this.decodeHtmlEntitiesForMermaid(content);

      // 2. <br> 태그를 Mermaid 라인 브레이크로 변환
      // Mermaid는 HTML <br>을 지원하지만, \n으로 통일하는 것이 더 안전함
      processed = processed.replace(/<br\s*\/?>/gi, '<br/>');

      // 3. 위험한 태그만 제거 (스크립트, 이벤트 핸들러 등)
      processed = DOMPurify.sanitize(processed, {
        ALLOWED_TAGS: ['br'], // br 태그만 허용
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
      });

      return processed.trim();
    } catch (error) {
      console.error('Mermaid content sanitization failed:', error);
      // Fallback: 기본 살균
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
      });
    }
  }

  /**
   * Mermaid용 HTML 엔티티 디코딩
   *
   * Mermaid 다이어그램에서 자주 사용되는 HTML 엔티티를 디코딩합니다.
   */
  private decodeHtmlEntitiesForMermaid(text: string): string {
    const entities: Record<string, string> = {
      '&lt;': '<',
      '&gt;': '>',
      '&amp;': '&',
      '&quot;': '"',
      '&#039;': "'",
      '&#x27;': "'",
      '&#x2F;': '/',
      '&#x5C;': '\\',
      '&#x60;': '`',
      '&nbsp;': ' ',
    };

    return text.replace(
      /&[#\w]+;/g,
      (entity) => entities[entity] || entity,
    );
  }
}