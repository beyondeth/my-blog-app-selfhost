import { Injectable } from '@nestjs/common';
import DOMPurify from 'isomorphic-dompurify';
import sanitizeHtml from 'sanitize-html';

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
      // YouTube iframe (특별 처리)
      'iframe',
      // 주석 (Mermaid placeholder용)
      '#comment',
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'target', 'rel',
      'data-*', // 데이터 속성
      'width', 'height',
      'class', 'style', // 스타일링
      'id', // 요소 식별
      // iframe 속성 (YouTube용)
      'frameborder', 'allow', 'allowfullscreen', 'loading',
      // 이미지 최적화
      'loading', 'decoding',
    ],
    ALLOW_DATA_ATTR: true,
    KEEP_CONTENT: true,
    // iframe은 YouTube만 허용
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['frameborder', 'allow', 'allowfullscreen', 'loading'],
    // YouTube URL만 허용
    ALLOWED_URI_REGEXP: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
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
      'iframe',
    ],
    allowedAttributes: {
      '*': ['class', 'style', 'data-*', 'id'],
      'a': ['href', 'target', 'rel', 'title'],
      'img': ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      'iframe': ['src', 'width', 'height', 'frameborder', 'allow', 'allowfullscreen', 'loading'],
      'button': ['data-code'],
    },
    allowedIframeHostnames: ['www.youtube.com', 'youtube.com', 'youtu.be'],
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: {
      img: ['http', 'https', 'data'],
    },
    allowCommentTag: true,
    transformTags: {
      // iframe을 YouTube만 허용하도록 필터링
      iframe: (tagName: string, attribs: any) => {
        const src = attribs.src || '';
        if (this.isYouTubeUrl(src)) {
          return {
            tagName: 'iframe',
            attribs: {
              ...attribs,
              loading: 'lazy',
            },
          };
        }
        // YouTube가 아닌 iframe은 제거
        return false;
      },
    },
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
        processedHtml = processedHtml.replace(
          /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/gi,
          (match, content) => {
            const placeholder = `<!--MERMAID_BLOCK_${mermaidBlocks.length}-->`;
            mermaidBlocks.push({ placeholder, content });
            return placeholder;
          },
        );
      }

      // DOMPurify로 살균
      const config = { ...this.domPurifyConfig };

      if (!allowIframes) {
        config.ALLOWED_TAGS = config.ALLOWED_TAGS.filter(tag => tag !== 'iframe');
      }

      if (!allowComments) {
        config.ALLOW_COMMENTS = false;
      }

      // iframe src 필터링을 위한 후크 추가
      if (typeof window !== 'undefined' && DOMPurify.isSupported) {
        DOMPurify.addHook('afterSanitizeAttributes', (node) => {
          // iframe은 YouTube만 허용
          if (node.tagName === 'IFRAME') {
            const src = node.getAttribute('src');
            if (src && !this.isYouTubeUrl(src)) {
              node.remove();
            }
          }
        });
      }

      let sanitized = DOMPurify.sanitize(processedHtml, config);

      // Mermaid 블록 복원
      if (preserveMermaid) {
        mermaidBlocks.forEach(({ placeholder, content }) => {
          // Mermaid 콘텐츠도 기본적인 살균 수행 (스크립트 태그 등 제거)
          const sanitizedContent = DOMPurify.sanitize(content, {
            ALLOWED_TAGS: [], // 태그 없이 텍스트만
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true,
          });
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

    if (!allowIframes) {
      config.allowedTags = config.allowedTags.filter(tag => tag !== 'iframe');
    }

    if (!allowComments) {
      config.allowCommentTag = false;
    }

    return sanitizeHtml(html, config);
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
        hostname === 'www.youtube.com' ||
        hostname === 'youtube.com' ||
        hostname === 'youtu.be' ||
        hostname === 'www.youtube-nocookie.com'
      );
    } catch {
      return false;
    }
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
}