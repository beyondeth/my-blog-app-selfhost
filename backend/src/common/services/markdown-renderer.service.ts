import { Injectable } from '@nestjs/common';

@Injectable()
export class MarkdownRendererService {
  
  convertToHtml(text: string): string {
    /**
     * 마크다운을 HTML로 변환 (기존 Python 로직을 정확히 포팅)
     */
    
    // 보호된 섹션을 저장할 맵들
    const protectedInline: Map<string, string> = new Map();
    const protectedTables: Map<string, string> = new Map();
    const codeBlockStore: Map<string, string> = new Map();
    
    // 테이블을 먼저 처리 (코드 블록보다 먼저 처리해야 함)
    const protectTable = (match: string): string => {
      const key = `[[TABLE${protectedTables.size}]]`;
      const lines = match.trim().split('\n');
      if (lines.length < 3) {
        return match;
      }
      
      let html = '<table class="markdown-table">';
      html += '<thead><tr>';
      
      // 헤더 처리 - 파이프로 구분하되 양끝 파이프는 선택적
      let headerLine = lines[0].trim();
      if (headerLine.startsWith('|')) {
        headerLine = headerLine.substring(1);
      }
      if (headerLine.endsWith('|')) {
        headerLine = headerLine.slice(0, -1);
      }
      
      const headers = headerLine.split('|').map(cell => cell.trim());
      for (const header of headers) {
        if (header) { // 빈 문자열 제외
          html += `<th class="markdown-table-header">${header}</th>`;
        }
      }
      html += '</tr></thead><tbody>';
      
      // 바디 처리 - 구분선(두 번째 줄) 이후부터
      for (let i = 2; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || !line.includes('|')) {
          continue;
        }
        
        // 양끝 파이프 제거
        if (line.startsWith('|')) {
          line = line.substring(1);
        }
        if (line.endsWith('|')) {
          line = line.slice(0, -1);
        }
        
        const cells = line.split('|').map(cell => cell.trim());
        if (cells.length > 0) { // 빈 행 제외
          html += '<tr>';
          for (const cell of cells) {
            // Python 로직과 일치: 빈 셀도 포함하되 올바른 조건 적용
            if (cell) {
              html += `<td class="markdown-table-cell">${cell}</td>`;
            }
          }
          html += '</tr>';
        }
      }
      
      html += '</tbody></table>';
      protectedTables.set(key, html);
      return key;
    };
    
    // 가장 먼저 코드 블록을 보호 (단락 처리 전에!)
    // 코드 블록 내부의 빈 줄이 단락 처리로 깨지는 것을 방지
    text = text.replace(/```([^\n]*)\n([\s\S]*?)```/gm, (_match, language, code) => {
      const key = `[[CODEBLOCK${codeBlockStore.size}]]`;
      const lang = language?.trim() || '';
      
      // HTML 특수문자 이스케이프
      let escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // 이미 이스케이프된 백틱은 건드리지 않고, 일반 백틱만 이스케이프
        .replace(/\\`/g, '[[ESCAPED_BACKTICK]]') // 임시 보호
        .replace(/`/g, '&#96;') // 일반 백틱 이스케이프
        .replace(/\[\[ESCAPED_BACKTICK\]\]/g, '`'); // 이스케이프된 백틱 복원
      
      let html: string;
      if (lang) {
        // hljs 클래스와 language 클래스만 추가, 스타일은 프론트엔드에서 처리
        html = `<pre class="hljs markdown-code-block"><code class="language-${lang}">${escapedCode}</code></pre>`;
      } else {
        html = `<pre class="hljs markdown-code-block"><code>${escapedCode}</code></pre>`;
      }
      
      codeBlockStore.set(key, html);
      return key;
    });
    
    // 테이블 패턴 매칭 및 보호 (더 유연한 패턴)
    text = text.replace(
      /(?:^|\n)(\|[^\n]+\|)\s*\n(\|[\s\-:|]+\|)\s*\n((?:\|[^\n]+\|\s*\n?)+)/gm,
      (match) => '\n' + protectTable(match)
    );
    
    // 인라인 코드 보호 (`...`)
    const protectInlineCode = (match: string, code: string): string => {
      const key = `[[INLINE${protectedInline.size}]]`;
      // HTML 특수문자 이스케이프
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const html = `<code class="markdown-inline-code">${escapedCode}</code>`;
      protectedInline.set(key, html);
      return key;
    };
    
    text = text.replace(/`([^`]+)`/g, protectInlineCode);
    
    // 제목 변환 (h1-h6)
    for (let level = 6; level >= 1; level--) {
      const pattern = new RegExp(`^${'#'.repeat(level)}\\s+(.+)$`, 'gm');
      text = text.replace(pattern, `<h${level} class="markdown-h${level}">$1</h${level}>`);
    }
    
    // 굵은 글씨
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    
    // 기울임
    text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_]+)_/g, '<em>$1</em>');
    
    // 취소선
    text = text.replace(/~~([^~]+)~~/g, '<s>$1</s>');
    
    // 링크 (외부 링크 아이콘 추가)
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, href) => {
      // 외부 링크인지 확인
      const isExternal = href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//');
      const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
      
      // 외부 링크 아이콘 SVG (인라인으로 포함)
      const externalIcon = isExternal ? 
        ' <svg class="markdown-external-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>' : '';
      
      const linkClass = isExternal ? 'markdown-external-link' : 'markdown-link';
      
      return `<a href="${href}"${targetAttr} class="${linkClass}">${linkText}${externalIcon}</a>`;
    });
    
    // 이미지
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" class="markdown-image">');
    
    // 수평선
    text = text.replace(/^---+$/gm, '<hr class="markdown-hr">');
    
    // 인용문
    text = text.replace(/^>\s+(.+)$/gm, '<blockquote class="markdown-blockquote">$1</blockquote>');
    
    // 리스트 처리
    const lines = text.split('\n');
    const resultLines: string[] = [];
    let inUl = false;
    let inOl = false;
    
    for (const line of lines) {
      if (/^\s*[-*+]\s+/.test(line)) {
        if (!inUl) {
          resultLines.push('<ul class="markdown-ul">');
          inUl = true;
        }
        const content = line.replace(/^\s*[-*+]\s+/, '').trim();
        resultLines.push(`<li class="markdown-li">${content}</li>`);
      } else if (/^\s*\d+\.\s+/.test(line)) {
        if (!inOl) {
          resultLines.push('<ol class="markdown-ol">');
          inOl = true;
        }
        const content = line.replace(/^\d+\.\s+/, '').trim();
        resultLines.push(`<li class="markdown-li">${content}</li>`);
      } else {
        if (inUl) {
          resultLines.push('</ul>');
          inUl = false;
        }
        if (inOl) {
          resultLines.push('</ol>');
          inOl = false;
        }
        resultLines.push(line);
      }
    }
    
    if (inUl) {
      resultLines.push('</ul>');
    }
    if (inOl) {
      resultLines.push('</ol>');
    }
    
    text = resultLines.join('\n');
    
    // 테이블과 인라인 코드만 먼저 복원 (코드 블록은 나중에)
    for (const [key, value] of protectedTables) {
      text = text.replace(key, value);
    }
    
    for (const [key, value] of protectedInline) {
      text = text.replace(key, value);
    }
    
    // 단락 처리 (코드 블록 플레이스홀더는 아직 유지)
    const paragraphs = text.split('\n\n');
    const formatted: string[] = [];
    
    for (let para of paragraphs) {
      para = para.trim();
      if (para) {
        // 코드 블록 플레이스홀더인지 확인
        const isCodeBlockPlaceholder = /^\[\[CODEBLOCK\d+\]\]$/.test(para);
        const isTablePlaceholder = /^\[\[TABLE\d+\]\]$/.test(para);
        
        // HTML 태그로 시작하지 않고, 플레이스홀더도 아닌 경우에만 p 태그로 감싸기
        if (!isCodeBlockPlaceholder && !isTablePlaceholder && 
            !/^<(?:h[1-6]|ul|ol|pre|blockquote|table|hr)/.test(para)) {
          para = para.replace(/\n/g, '<br>');
          para = `<p class="markdown-p">${para}</p>`;
        }
        formatted.push(para);
      }
    }
    
    // 최종 텍스트 조합
    let finalText = formatted.filter(p => p.length > 0).join('\n');
    
    // 마지막에 코드 블록 복원 (단락 처리 후)
    for (const [key, value] of codeBlockStore) {
      finalText = finalText.replace(key, value);
    }
    
    return finalText;
  }

  parseMarkdown(content: string): { metadata: any; body: string } {
    /**
     * 마크다운 파싱 및 메타데이터 추출 (기존 로직 유지)
     */
    const metadata = {
      title: 'Untitled',
      category: 'general',
      tags: []
    };
    let body = content;

    // Front matter 처리
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