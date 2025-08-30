import { Injectable } from '@nestjs/common';

@Injectable()
export class MarkdownRendererService {
  
  convertToHtml(text: string): string {
    /**
     * 마크다운을 HTML로 변환 (기존 Python 로직을 정확히 포팅)
     */
    
    // 보호된 섹션을 저장할 맵들
    const protectedBlocks: Map<string, string> = new Map();
    const protectedInline: Map<string, string> = new Map();
    const protectedTables: Map<string, string> = new Map();
    
    // 테이블을 먼저 처리 (코드 블록보다 먼저 처리해야 함)
    const protectTable = (match: string): string => {
      const key = `[[TABLE${protectedTables.size}]]`;
      const lines = match.trim().split('\n');
      if (lines.length < 3) {
        return match;
      }
      
      let html = '<table style="border-collapse: collapse; width: 100%; margin: 1em 0;">';
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
          html += `<th style="border: 1px solid #ddd; padding: 8px; background-color: #f2f2f2; text-align: left;">${header}</th>`;
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
              html += `<td style="border: 1px solid #ddd; padding: 8px;">${cell}</td>`;
            }
          }
          html += '</tr>';
        }
      }
      
      html += '</tbody></table>';
      protectedTables.set(key, html);
      return key;
    };
    
    // 테이블 패턴 매칭 및 보호 (더 유연한 패턴)
    text = text.replace(
      /(?:^|\n)(\|[^\n]+\|)\s*\n(\|[\s\-:|]+\|)\s*\n((?:\|[^\n]+\|\s*\n?)+)/gm,
      (match) => '\n' + protectTable(match)
    );
    
    // 코드 블록 보호 (```...```)
    const protectCodeBlock = (match: string, language: string, code: string): string => {
      const key = `[[CODEBLOCK${protectedBlocks.size}]]`;
      const lang = language?.trim() || '';
      
      // HTML 특수문자 이스케이프
      let escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/`/g, '&#96;'); // 백틱 이스케이프
      
      let html: string;
      if (lang) {
        html = `<pre style="background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto;"><code class="language-${lang}">${escapedCode}</code></pre>`;
      } else {
        html = `<pre style="background: #f4f4f4; padding: 1em; border-radius: 4px; overflow-x: auto;"><code>${escapedCode}</code></pre>`;
      }
      
      protectedBlocks.set(key, html);
      return key;
    };
    
    // 더 정확한 코드 블록 매칭 (줄 시작에서만 매칭)
    text = text.replace(/^```([^\n]*)\n(.*?)\n```/gms, protectCodeBlock);
    
    // 인라인 코드 보호 (`...`)
    const protectInlineCode = (match: string, code: string): string => {
      const key = `[[INLINE${protectedInline.size}]]`;
      // HTML 특수문자 이스케이프
      const escapedCode = code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      const html = `<code style="background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace;">${escapedCode}</code>`;
      protectedInline.set(key, html);
      return key;
    };
    
    text = text.replace(/`([^`]+)`/g, protectInlineCode);
    
    // 제목 변환 (h1-h6)
    for (let level = 6; level >= 1; level--) {
      const pattern = new RegExp(`^${'#'.repeat(level)}\\s+(.+)$`, 'gm');
      text = text.replace(pattern, `<h${level}>$1</h${level}>`);
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
        ' <svg style="display: inline-block; width: 0.75rem; height: 0.75rem; margin-left: 0.125rem; vertical-align: baseline;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>' : '';
      
      return `<a href="${href}"${targetAttr} style="color: #0EA5E9; text-decoration: none; background-color: #F0F9FF; padding: 2px 4px; border-radius: 3px; transition: all 0.2s ease; border-bottom: 2px solid transparent; display: inline; white-space: nowrap;">${linkText}${externalIcon}</a>`;
    });
    
    // 이미지
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;">');
    
    // 수평선
    text = text.replace(/^---+$/gm, '<hr style="border: none; border-top: 1px solid #ccc; margin: 2em 0;">');
    
    // 인용문
    text = text.replace(/^>\s+(.+)$/gm, '<blockquote style="border-left: 4px solid #ddd; margin: 1em 0; padding-left: 1em; color: #666;">$1</blockquote>');
    
    // 리스트 처리
    const lines = text.split('\n');
    const resultLines: string[] = [];
    let inUl = false;
    let inOl = false;
    
    for (const line of lines) {
      if (/^\s*[-*+]\s+/.test(line)) {
        if (!inUl) {
          resultLines.push('<ul>');
          inUl = true;
        }
        const content = line.replace(/^\s*[-*+]\s+/, '').trim();
        resultLines.push(`<li>${content}</li>`);
      } else if (/^\s*\d+\.\s+/.test(line)) {
        if (!inOl) {
          resultLines.push('<ol>');
          inOl = true;
        }
        const content = line.replace(/^\d+\.\s+/, '').trim();
        resultLines.push(`<li>${content}</li>`);
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
    
    // 보호된 요소들 복원 (테이블, 코드 블록, 인라인 코드)
    for (const [key, value] of protectedTables) {
      text = text.replace(key, value);
    }
    
    for (const [key, value] of protectedBlocks) {
      text = text.replace(key, value);
    }
    
    for (const [key, value] of protectedInline) {
      text = text.replace(key, value);
    }
    
    // 단락 처리
    const paragraphs = text.split('\n\n');
    const formatted: string[] = [];
    
    for (let para of paragraphs) {
      para = para.trim();
      if (para) {
        // HTML 태그로 시작하지 않으면 p 태그로 감싸기
        if (!/^<(?:h[1-6]|ul|ol|pre|blockquote|table|hr)/.test(para)) {
          para = para.replace(/\n/g, '<br>');
          para = `<p style="line-height: 1.6;">${para}</p>`;
        }
      }
      formatted.push(para);
    }
    
    return formatted.join('\n');
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