import { Injectable } from '@nestjs/common';
import { JSDOM } from 'jsdom';

/**
 * 코드 하이라이트 서비스
 *
 * HTML 콘텐츠 내의 코드 블록을 처리하고 준비합니다.
 * 실제 하이라이팅은 프론트엔드에서 수행되지만,
 * 백엔드에서는 코드 블록을 적절히 구조화하고 메타데이터를 추가합니다.
 */
@Injectable()
export class CodeHighlightService {
  /**
   * HTML 내의 코드 블록을 처리합니다.
   *
   * @param html - 처리할 HTML 문자열
   * @returns 처리된 HTML 문자열
   */
  processCodeBlocks(html: string): string {
    if (!html) return '';

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // 모든 pre > code 블록 찾기
      const codeBlocks = document.querySelectorAll('pre code');

      codeBlocks.forEach((codeElement) => {
        const preElement = codeElement.parentElement;
        if (!preElement) return;

        // 언어 클래스 확인
        const languageClass = Array.from(codeElement.classList).find(cls =>
          cls.startsWith('language-'),
        );

        if (languageClass) {
          const language = languageClass.replace('language-', '');

          // Mermaid 블록은 특별 처리 (건드리지 않음)
          if (language === 'mermaid') {
            // Mermaid 블록에 표준 속성만 추가 (data-diagram 제거)
            // data-diagram 속성은 파싱 문제를 일으킬 수 있으므로 제거
            codeElement.setAttribute('data-language', 'mermaid');
            preElement.setAttribute('data-language', 'mermaid');
            // class는 그대로 유지 (language-mermaid)
            return;
          }

          // 일반 코드 블록 처리
          codeElement.setAttribute('data-language', language);

          // 코드 블록 래퍼 추가를 위한 마크업 준비
          preElement.classList.add('code-block');
          preElement.setAttribute('data-language', language);

          // 복사 버튼을 위한 데이터 속성 추가
          const codeText = codeElement.textContent || '';
          preElement.setAttribute('data-code-content', this.encodeCodeContent(codeText));
        } else {
          // 언어가 지정되지 않은 코드 블록
          preElement.classList.add('code-block');
          preElement.setAttribute('data-language', 'plaintext');
          codeElement.setAttribute('data-language', 'plaintext');

          const codeText = codeElement.textContent || '';
          preElement.setAttribute('data-code-content', this.encodeCodeContent(codeText));
        }

        // 코드 블록에 고유 ID 추가 (프론트엔드에서 참조용)
        const blockId = this.generateCodeBlockId();
        preElement.setAttribute('data-code-id', blockId);
      });

      // 인라인 코드 처리
      const inlineCodeElements = document.querySelectorAll('code:not(pre code)');
      inlineCodeElements.forEach((codeElement) => {
        codeElement.classList.add('inline-code');
      });

      return document.body.innerHTML;
    } catch (error) {
      console.error('Error processing code blocks:', error);
      return html;
    }
  }

  /**
   * 코드 콘텐츠를 안전하게 인코딩합니다.
   *
   * @param code - 인코딩할 코드
   * @returns base64 인코딩된 코드
   */
  private encodeCodeContent(code: string): string {
    // Base64 인코딩하여 HTML 속성에 안전하게 저장
    return Buffer.from(code).toString('base64');
  }

  /**
   * 코드 블록용 고유 ID를 생성합니다.
   *
   * @returns 고유 ID
   */
  private generateCodeBlockId(): string {
    return `code_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 코드 블록에서 언어를 추출합니다.
   *
   * @param html - HTML 문자열
   * @returns 사용된 언어 목록
   */
  extractLanguages(html: string): string[] {
    if (!html) return [];

    const languages = new Set<string>();

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const codeBlocks = document.querySelectorAll('pre code[class*="language-"]');
      codeBlocks.forEach((codeElement) => {
        const languageClass = Array.from(codeElement.classList).find(cls =>
          cls.startsWith('language-'),
        );

        if (languageClass) {
          const language = languageClass.replace('language-', '');
          if (language !== 'mermaid') {
            // Mermaid는 프로그래밍 언어가 아님
            languages.add(language);
          }
        }
      });
    } catch (error) {
      console.error('Error extracting languages:', error);
    }

    return Array.from(languages);
  }

  /**
   * 코드 블록 통계를 생성합니다.
   *
   * @param html - HTML 문자열
   * @returns 코드 블록 통계
   */
  getCodeBlockStats(html: string): {
    total: number;
    byLanguage: Record<string, number>;
    totalLines: number;
    hasMermaid: boolean;
  } {
    const stats = {
      total: 0,
      byLanguage: {} as Record<string, number>,
      totalLines: 0,
      hasMermaid: false,
    };

    if (!html) return stats;

    try {
      const dom = new JSDOM(html);
      const document = dom.window.document;

      const codeBlocks = document.querySelectorAll('pre code');
      stats.total = codeBlocks.length;

      codeBlocks.forEach((codeElement) => {
        const languageClass = Array.from(codeElement.classList).find(cls =>
          cls.startsWith('language-'),
        );

        const language = languageClass
          ? languageClass.replace('language-', '')
          : 'plaintext';

        if (language === 'mermaid') {
          stats.hasMermaid = true;
        }

        stats.byLanguage[language] = (stats.byLanguage[language] || 0) + 1;

        // 라인 수 계산
        const lines = (codeElement.textContent || '').split('\n').length;
        stats.totalLines += lines;
      });
    } catch (error) {
      console.error('Error calculating code stats:', error);
    }

    return stats;
  }
}