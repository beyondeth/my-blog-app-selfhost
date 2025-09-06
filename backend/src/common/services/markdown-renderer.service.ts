import { Injectable } from '@nestjs/common';
import { marked } from 'marked';

@Injectable()
export class MarkdownRendererService {
  constructor() {
    // marked 기본 설정
    marked.setOptions({
      // 표준 옵션들
      gfm: true,           // GitHub Flavored Markdown 지원
      breaks: true,        // 줄바꿈을 <br>로 변환
      pedantic: false,     // 표준 마크다운 호환성
    });

    // 커스텀 렌더러 설정 - 최소한의 처리만
    const renderer = new marked.Renderer();
    
    // 코드 블록: language 클래스만 추가 (highlight.js를 위해)
    renderer.code = function({ text, lang }) {
      const language = lang || '';
      const escapedCode = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      if (language) {
        return `<pre><code class="language-${language}">${escapedCode}</code></pre>`;
      }
      return `<pre><code>${escapedCode}</code></pre>`;
    };

    // 링크: 외부 링크에 target="_blank" 추가
    renderer.link = function({ href, title, tokens }) {
      const text = this.parser?.parseInline(tokens) || '';
      const isExternal = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
      const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      const titleAttr = title ? ` title="${title}"` : '';
      return `<a href="${href}"${titleAttr}${targetAttr}>${text}</a>`;
    };

    marked.use({ renderer });
  }
  
  convertToHtml(text: string): string {
    /**
     * 표준 marked 라이브러리를 사용한 마크다운 → HTML 변환
     * 모든 복잡한 파싱 로직은 marked가 처리
     */
    return marked.parse(text) as string;
  }

  parseMarkdown(content: string): { metadata: any; body: string } {
    /**
     * Front matter 추출 및 본문 분리
     * YAML front matter 처리는 유지 (포스트 메타데이터 필요)
     */
    const metadata = {
      title: 'Untitled',
      category: 'general',
      tags: []
    };
    let body = content;

    // Front matter 처리 (--- 로 감싸진 YAML)
    if (content.startsWith('---')) {
      const parts = content.split('---', 3);
      if (parts.length >= 3) {
        const frontMatter = parts[1].trim();
        body = parts[2].trim();
        
        // 간단한 YAML 파싱
        const lines = frontMatter.split('\n');
        for (const line of lines) {
          const colonIndex = line.indexOf(':');
          if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            
            // 따옴표 제거
            if ((value.startsWith('"') && value.endsWith('"')) || 
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            
            // 배열 처리 (간단한 JSON 파싱)
            if (value.startsWith('[') && value.endsWith(']')) {
              try {
                metadata[key] = JSON.parse(value);
              } catch {
                metadata[key] = [value];
              }
            } else {
              metadata[key] = value;
            }
          }
        }
      }
    }

    // 첫 번째 h1에서 제목 추출 (front matter가 없는 경우)
    if (metadata.title === 'Untitled') {
      const h1Match = body.match(/^#\s+(.+)$/m);
      if (h1Match) {
        metadata.title = h1Match[1].trim();
      }
    }

    return { metadata, body };
  }
}