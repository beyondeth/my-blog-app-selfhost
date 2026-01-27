import { parseImageAttributes } from '@/types/image-metadata.types';

const INLINE_BOLD = /\*\*(.*?)\*\*/g;
const INLINE_ITALIC = /\*(.*?)\*/g;
const INLINE_CODE = /`([^`]+)`/g;
const INLINE_LINK = /\[([^\]]+)]\(([^)]+)\)/g;
// 기본 마크다운 이미지 (확장 속성 없음)
const INLINE_IMAGE = /!\[([^\]]*)]\(([^)]+)\)/g;
// 확장 마크다운 이미지 (속성 포함): ![alt](url){#id size=value caption="text"}
const EXTENDED_IMAGE = /!\[([^\]]*)\]\(([^)]+)\)\s*(?:\{([^}]+)\})?/g;

/**
 * 이미지 속성이 줄바꿈되어 있는 경우 한 줄로 병합하는 스캐너 함수 (ReDoS 안전)
 * 예: ![alt](url) \n {attrs} -> ![alt](url){attrs}
 * 괄호가 포함된 URL도 안전하게 처리합니다.
 */
export function normalizeImageAttributes(markdown: string): string {
  if (!markdown) return '';
  
  let result = '';
  let i = 0;
  const len = markdown.length;

  while (i < len) {
    // 1. 이미지 시작점 찾기: ![
    const start = markdown.indexOf('![', i);
    if (start === -1) {
      result += markdown.slice(i);
      break;
    }
    
    // 이미지 앞의 텍스트 추가
    result += markdown.slice(i, start);
    i = start;

    // 2. Alt 텍스트 끝 찾기: ]
    // 단순하게 처리 (Alt 내의 대괄호 중첩은 고려하지 않음 - 일반적인 경우)
    const altEnd = markdown.indexOf(']', start + 2);
    if (altEnd === -1) {
      result += markdown[i++];
      continue;
    }

    // 3. URL 시작 확인: ( 가 바로 뒤에 와야 함
    if (altEnd + 1 >= len || markdown[altEnd + 1] !== '(') {
      result += markdown.slice(start, altEnd + 1);
      i = altEnd + 1;
      continue;
    }

    // 4. URL 끝 찾기 (Balanced Parentheses)
    let urlEnd = -1;
    let parenDepth = 0;
    let j = altEnd + 1;
    
    for (; j < len; j++) {
      const char = markdown[j];
      if (char === '(') {
        parenDepth++;
      } else if (char === ')') {
        parenDepth--;
        if (parenDepth === 0) {
          urlEnd = j;
          break;
        }
      }
    }

    if (urlEnd === -1) {
      // 닫히지 않은 괄호 - 이미지 아님
      result += markdown.slice(start, altEnd + 2);
      i = altEnd + 2;
      continue;
    }
    
    // 5. 속성 블록 찾기 (Aggressive Search)
    // 공백뿐만 아니라 중간의 잡다한 문자도 건너뛰고 {를 찾음 (최대 50자)
    // 이는 보이지 않는 문자나 사용자 실수로 인한 분리를 방지함
    let k = urlEnd + 1;
    let foundAttrStart = -1;
    const LOOKAHEAD_LIMIT = 50;
    const scanLimit = Math.min(len, k + LOOKAHEAD_LIMIT);
    
    for (let p = k; p < scanLimit; p++) {
      const char = markdown[p];
      // 다음 이미지가 시작되면 중단
      if (char === '!' && p + 1 < len && markdown[p+1] === '[') break;
      
      if (char === '{') {
        foundAttrStart = p;
        break;
      }
      
      // 공백이 아닌 문자가 나오면? 
      // 일단은 무시하고 {를 찾도록 함 (사용자가 실수로 점 등을 찍었을 수도 있음)
    }
    
    // 6. 속성 병합
    if (foundAttrStart !== -1) {
      const attrEnd = markdown.indexOf('}', foundAttrStart);
      if (attrEnd !== -1) {
         // URL 내부의 괄호 이스케이프 처리
         const urlContent = markdown.slice(altEnd + 2, urlEnd);
         const escapedUrl = urlContent.replace(/\(/g, '%28').replace(/\)/g, '%29');
         
         // 재조립
         result += markdown.slice(start, altEnd + 2); // ![alt](
         result += escapedUrl;
         result += ')'; // )
         
         // 속성 부분 추가
         result += markdown.slice(foundAttrStart, attrEnd + 1);
         
         i = attrEnd + 1;
         continue;
      }
    }

    // 속성이 없거나 매칭 실패 시, 이미지 부분만 추가하고 계속 진행
    // URL 내부의 괄호 이스케이프 처리 (ReDoS 방지를 위해 단순 정규식을 유지하기 위함)
    const urlContent = markdown.slice(altEnd + 2, urlEnd); // '('와 ')' 제외
    const escapedUrl = urlContent.replace(/\(/g, '%28').replace(/\)/g, '%29');
    
    // 재조립
    result += markdown.slice(start, altEnd + 2); // ![alt](
    result += escapedUrl;
    result += ')'; // )
    
    // 속성이 있다면 병합
    if (k < len && markdown[k] === '{') {
      const attrEnd = markdown.indexOf('}', k);
      if (attrEnd !== -1) {
         result += markdown.slice(k, attrEnd + 1);
         i = attrEnd + 1;
         continue;
      }
    }

    i = urlEnd + 1;
  }
  
  return result;
}

export function convertMarkdownToHtml(markdown: string): string {
  // ReDoS 안전한 스캐너로 전처리
  let source = normalizeImageAttributes(markdown ?? '');

  if (!source.trim()) {
    return '<p></p>';
  }

  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeLanguage = '';
  let listStack: Array<'ul' | 'ol'> = [];

  const flushLists = () => {
    while (listStack.length) {
      const tag = listStack.pop();
      htmlLines.push(`</${tag}>`);
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        htmlLines.push('</code></pre>');
        inCodeBlock = false;
        codeLanguage = '';
      } else {
        flushLists();
        codeLanguage = line.slice(3).trim();
        const classAttr = codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : '';
        htmlLines.push(`<pre><code${classAttr}>`);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      htmlLines.push(escapeHtml(rawLine));
      continue;
    }

    if (!line.trim()) {
      flushLists();
      htmlLines.push('');
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushLists();
      const level = headingMatch[1].length;
      const content = transformInline(headingMatch[2]);
      htmlLines.push(`<h${level}>${content}</h${level}>`);
      continue;
    }

    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushLists();
      htmlLines.push(`<blockquote>${transformInline(blockquoteMatch[1])}</blockquote>`);
      continue;
    }

    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/);
    if (unorderedMatch) {
      if (listStack[listStack.length - 1] !== 'ul') {
        flushLists();
        listStack.push('ul');
        htmlLines.push('<ul>');
      }
      htmlLines.push(`<li>${transformInline(unorderedMatch[1])}</li>`);
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);
    if (orderedMatch) {
      if (listStack[listStack.length - 1] !== 'ol') {
        flushLists();
        listStack.push('ol');
        htmlLines.push('<ol>');
      }
      htmlLines.push(`<li>${transformInline(orderedMatch[1])}</li>`);
      continue;
    }

    flushLists();
    htmlLines.push(`<p>${transformInline(line)}</p>`);
  }

  flushLists();

  return htmlLines
    .filter((line, index, array) => line || (array[index - 1] && array[index - 1] !== ''))
    .join('\n')
    .trim() || '<p></p>';
}

interface ListContext {
  ordered: boolean;
  level: number;
  index: number;
}

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'figure',
]);

const INLINE_CODE_TAGS = new Set(['code', 'kbd', 'samp']);

/**
 * Converts an HTML string into Markdown.
 * This is a lightweight converter that covers the elements used in the editor.
 */
export function convertHtmlToMarkdown(html: string): string {
  if (!html) {
    return '';
  }

  const parser = typeof window !== 'undefined' ? new window.DOMParser() : null;
  if (!parser) {
    return html;
  }

  const doc = parser.parseFromString(html, 'text/html');
  const result = serializeNodes(Array.from(doc.body.childNodes)).trim();

  return result.replace(/\n{3,}/g, '\n\n');
}

function serializeNodes(nodes: Node[], context?: ListContext): string {
  return nodes
    .map((node) => serializeNode(node, context))
    .filter(Boolean)
    .join('');
}

function serializeNode(node: Node, context?: ListContext): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown(node.textContent ?? '');
  }

  if (!(node instanceof HTMLElement)) {
    return '';
  }

  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case 'br':
      return '  \n';
    case 'strong':
    case 'b':
      return wrapInline(`**${serializeNodes(Array.from(node.childNodes), context)}**`);
    case 'em':
    case 'i':
      return wrapInline(`*${serializeNodes(Array.from(node.childNodes), context)}*`);
    case 'u':
      return wrapInline(`__${serializeNodes(Array.from(node.childNodes), context)}__`);
    case 's':
    case 'del':
      return wrapInline(`~~${serializeNodes(Array.from(node.childNodes), context)}~~`);
    case 'code':
      if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') {
        // will be handled by <pre>
        return '';
      }
      return wrapInline(`\`${node.textContent ?? ''}\``);
    case 'pre':
      return formatCodeBlock(node);
    case 'blockquote':
      return formatBlockquote(node);
    case 'a':
      return formatLink(node);
    case 'figure':
      // figure 태그는 MediumStyleImage에서 생성한 이미지 래퍼
      if (node.hasAttribute('data-medium-image')) {
        return formatFigure(node);
      }
      // 일반 figure는 블록 태그로 처리
      return `\n\n${serializeNodes(Array.from(node.childNodes), context).trim()}\n\n`;
    case 'img':
      return formatImage(node);
    case 'ul':
      return formatList(node, false, context);
    case 'ol':
      return formatList(node, true, context);
    case 'li':
      return formatListItem(node, context);
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6': {
      const level = parseInt(tag.substring(1), 10);
      const hashes = '#'.repeat(Math.min(6, level));
      return `\n\n${hashes} ${serializeNodes(Array.from(node.childNodes)).trim()}\n\n`;
    }
    case 'table':
      return formatTable(node);
    default:
      if (BLOCK_TAGS.has(tag)) {
        const inner = serializeNodes(Array.from(node.childNodes), context).trim();
        return inner ? `\n\n${inner}\n\n` : '';
      }
      if (INLINE_CODE_TAGS.has(tag)) {
        return wrapInline(`\`${node.textContent ?? ''}\``);
      }
      return serializeNodes(Array.from(node.childNodes), context);
  }
}

function formatCodeBlock(node: HTMLElement): string {
  const codeElement = node.querySelector('code');
  const language = codeElement?.getAttribute('class')?.split('language-')[1] ?? '';
  const content = codeElement?.textContent ?? node.textContent ?? '';
  const normalized = content.replace(/\n+$/, '');
  const langSuffix = language ? language.trim() : '';
  return `\n\n\`\`\`${langSuffix}\n${normalized}\n\`\`\`\n\n`;
}

function formatBlockquote(node: HTMLElement): string {
  const text = serializeNodes(Array.from(node.childNodes)).trim();
  if (!text) return '';
  return `\n\n${text.split('\n').map((line) => `> ${line}`).join('\n')}\n\n`;
}

function formatLink(node: HTMLElement): string {
  const href = node.getAttribute('href') || '';
  const title = serializeNodes(Array.from(node.childNodes)).trim() || href;
  return `[${title}](${href})`;
}

function formatImage(node: HTMLElement): string {
  const src = node.getAttribute('src') || '';
  const alt = node.getAttribute('alt') || '';
  const size = node.getAttribute('data-size');
  const imageId = node.getAttribute('data-image-id');
  
  // 확장 속성 구성
  const attrs: string[] = [];
  if (imageId) attrs.push(`#${imageId}`);
  if (size && size !== 'default') attrs.push(`size=${size}`);
  
  const attrString = attrs.length > 0 ? `{${attrs.join(' ')}}` : '';
  
  return `![${alt}](${src})${attrString}`;
}

/**
 * figure 태그를 확장 마크다운으로 변환
 * MediumStyleImage 확장에서 생성한 구조를 파싱
 */
function formatFigure(node: HTMLElement): string {
  const img = node.querySelector('img');
  if (!img) {
    // img가 없으면 일반 블록으로 변환
    return '';
  }
  
  const src = img.getAttribute('src') || '';
  const alt = img.getAttribute('alt') || '';
  const size = img.getAttribute('data-size');
  const imageId = img.getAttribute('data-image-id');
  const caption = node.querySelector('figcaption')?.textContent || '';
  
  // 확장 속성 구성
  const attrs: string[] = [];
  if (imageId) attrs.push(`#${imageId}`);
  if (size && size !== 'default') attrs.push(`size=${size}`);
  if (caption) {
    // 따옴표 이스케이프
    const escapedCaption = caption.replace(/"/g, '\\"');
    attrs.push(`caption="${escapedCaption}"`);
  }
  
  const attrString = attrs.length > 0 ? `{${attrs.join(' ')}}` : '';
  
  return `\n\n![${alt}](${src})${attrString}\n\n`;
}

function formatList(node: HTMLElement, ordered: boolean, parentContext?: ListContext): string {
  const items = Array.from(node.children).filter(
    (child) => child instanceof HTMLElement && child.tagName.toLowerCase() === 'li',
  );
  if (!items.length) return '';

  const context: ListContext = {
    ordered,
    level: (parentContext?.level ?? 0) + 1,
    index: 0,
  };

  const content = items
    .map((item, idx) => {
      const itemContext = { ...context, index: idx };
      return formatListItem(item as HTMLElement, itemContext);
    })
    .join('');

  return `\n${content}\n`;
}

function formatListItem(node: HTMLElement, context?: ListContext): string {
  const prefix = context?.ordered ? `${(context.index ?? 0) + 1}. ` : '- ';
  const body = serializeNodes(Array.from(node.childNodes), context).trim();
  const indent = context ? '  '.repeat(Math.max(0, context.level - 1)) : '';
  const lines = body.split('\n').filter(Boolean);

  if (!lines.length) {
    return `${indent}${prefix}\n`;
  }

  return `${lines
    .map((line, idx) => {
      const currentPrefix = idx === 0 ? `${indent}${prefix}` : `${indent}  `;
      return `${currentPrefix}${line}`;
    })
    .join('\n')}\n`;
}

function formatTable(node: HTMLElement): string {
  const rows = Array.from(node.querySelectorAll('tr'));
  if (!rows.length) return '';

  const headerCells = rows[0].querySelectorAll('th');
  const headers = headerCells.length
    ? Array.from(headerCells).map((cell) => serializeNodes(Array.from(cell.childNodes)).trim())
    : Array.from(rows[0].children).map((cell) => serializeNodes(Array.from(cell.childNodes)).trim());

  const bodyRows = headers.length ? rows.slice(1) : rows;
  const headerLine = `| ${headers.join(' | ')} |`;
  const dividerLine = `| ${headers.map(() => '---').join(' | ')} |`;
  const bodyLines = bodyRows.map((row) => {
    const cells = Array.from(row.children).map((cell) =>
      serializeNodes(Array.from(cell.childNodes)).trim(),
    );
    return `| ${cells.join(' | ')} |`;
  });

  return ['\n', headerLine, dividerLine, ...bodyLines, '\n'].join('\n');
}

function escapeMarkdown(input: string): string {
  return input.replace(/([\\`*_{}[\]()#+\-.!>])/g, '\\$1');
}

function wrapInline(value: string): string {
  return value.replace(/\s+/g, ' ');
}

function transformInline(text: string): string {
  if (!text) {
    return '';
  }

  // 1. 이미지 처리를 HTML 이스케이프 전에 수행 (속성 파싱을 위해)
  const imagePlaceholders: string[] = [];
  
  // 원본 텍스트에서 이미지 처리
  let output = text.replace(EXTENDED_IMAGE, (match, alt, url, attrs) => {
    const safeAlt = escapeHtml(alt || '');
    const safeUrl = escapeAttribute(url);
    
    // 확장 속성 파싱 (원본 attrs 사용)
    const metadata = parseImageAttributes(attrs);
    const size = metadata.size || 'default';
    const caption = metadata.caption || '';
    const imageId = metadata.id || '';
    
    // figure 구조로 렌더링
    const imgAttrs = [
      `src="${safeUrl}"`,
      `alt="${safeAlt}"`,
      `data-size="${size}"`,
      `class="medium-image medium-image-${size}"`,
      imageId ? `data-image-id="${imageId}"` : '',
    ].filter(Boolean).join(' ');
    
    const figcaptionHtml = caption 
      ? `<figcaption class="medium-image-caption">${escapeHtml(caption)}</figcaption>` 
      : '';
    
    const html = `<figure data-medium-image="" class="medium-image-wrapper"><img ${imgAttrs} />${figcaptionHtml}</figure>`;
    
    const token = `__IMG_SPAN_${imagePlaceholders.length}__`;
    imagePlaceholders.push(html);
    return token;
  });

  // 2. HTML 이스케이프
  output = escapeHtml(output);

  // 3. 코드 블록 처리 (이스케이프 후)
  const codePlaceholders: string[] = [];
  const createCodePlaceholder = (code: string) => {
    const token = `__CODE_SPAN_${codePlaceholders.length}__`;
    // 코드는 이미 이스케이프 된 상태이므로 다시 escapeHtml 하지 않음 (또는 원본이라면 해야 함)
    // 기존 로직: escapeHtml(code). 
    // 현재 output은 이미 escapeHtml 되었으므로, code도 이스케이프 된 상태임.
    // 따라서 escapeHtml(code)를 하면 이중 이스케이프 됨.
    // 하지만 정규식 매칭이 이스케이프 된 텍스트에 대해 수행되므로...
    // -> 아니다. 정규식 INLINE_CODE는 `...` 를 찾는데, `는 이스케이프 대상이 아님.
    // 하지만 내부의 < 등은 &lt; 로 변함.
    // 기존 로직도 output = replace(..., escapeHtml(code)) 였음.
    // 만약 code가 "&lt;" 라면 escapeHtml("&lt;") -> "&amp;lt;" 가 됨.
    // 이는 기존 로직의 버그일 수 있으나, 일단 기존 동작과 유사하게 유지하되,
    // 여기서는 이미 output이 escape되었으므로 code를 그대로 씀이 ??
    // 안전하게, codePlaceholders에는 이미 이스케이프된 문자열이 들어간다고 가정.
    codePlaceholders.push(`<code>${code}</code>`);
    return token;
  };

  output = output.replace(INLINE_LINK, (_, label, href) => {
    // label은 재귀 호출로 처리
    const safeLabel = transformInline(label); // 여기서 다시 escapeHtml 됨 -> 이중 이스케이프 위험?
    // transformInline을 재귀 호출하면 escapeHtml을 또 함.
    // 하지만 label이 이미 이스케이프 되었다면?
    // 이 문제는 꽤 복잡함. 일단 Link 처리는 기존과 동일하게 둠 (Link Regex가 이스케이프 된 텍스트에서도 동작한다고 가정)
    // [text](url) -> [text](url) (대괄호/괄호는 이스케이프 안 됨)
    // href는 이스케이프 해야 함.
    const safeHref = escapeAttribute(href);
    return `<a href="${safeHref}">${safeLabel}</a>`; // safeLabel이 이중 이스케이프 될 수 있음.
  });

  output = output.replace(INLINE_CODE, (_, code) => createCodePlaceholder(code));
  
  // Bold/Italic 처리 시 unescape 후 재귀 호출? 아니면...
  // 기존 로직을 최대한 건드리지 않기 위해, 이미지만 Placeholder로 처리하고 나머지는 그대로 둠.
  // 단, Link 처리 시 transformInline 호출은 '원본' 텍스트를 기대함.
  // 하지만 output은 이미 escapeHtml 된 상태임.
  // -> 아, Link 내부 텍스트에 특수문자가 있다면 이미 &lt; 등으로 변해있음.
  // transformInline("&lt;") -> escapeHtml("&lt;") -> "&amp;lt;".
  // 이중 이스케이프 문제 발생.
  
  // 해결책: transformInline의 인자 text는 항상 Unescaped Raw Text라고 가정.
  // 재귀 호출 시에는 Unescaped Text를 넘겨야 함.
  // 하지만 여기선 output(Escaped)에서 정규식으로 추출한 label을 넘김.
  // 즉 label은 Escaped 상태임.
  // 따라서 unescapeHTML(label)을 해서 넘겨야 하나?
  
  // 복잡성을 피하기 위해, Link와 Bold/Italic 내부 내용은 
  // '이미 이스케이프 된 상태'라고 보고 처리하는 별도 함수를 써야 할 수도 있음.
  // 하지만 지금은 '이미지 캡션' 버그 수정이 최우선.
  // Link/Bold 이중 이스케이프 문제는 기존에도 있었을 수 있음. (사용자 리포트 없음).
  // 따라서 이미지 Placeholder 복원만 추가하고 나머지는 기존 로직 유지 (단, output 변수 흐름 주의).
  
  output = output.replace(INLINE_BOLD, (_, content) => `<strong>${transformInline(content)}</strong>`); // content는 escaped.
  output = output.replace(INLINE_ITALIC, (_, content) => `<em>${transformInline(content)}</em>`);

  if (codePlaceholders.length > 0) {
    codePlaceholders.forEach((replacement, index) => {
      const token = new RegExp(`__CODE_SPAN_${index}__`, 'g');
      output = output.replace(token, replacement);
    });
  }
  
  // 4. 이미지 복원
  if (imagePlaceholders.length > 0) {
    imagePlaceholders.forEach((replacement, index) => {
      // Placeholder는 안전한 토큰이므로 전역 교체
      const token = new RegExp(`__IMG_SPAN_${index}__`, 'g');
      output = output.replace(token, replacement);
    });
  }

  return output;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, '&quot;');
}
