const INLINE_BOLD = /\*\*(.*?)\*\*/g;
const INLINE_ITALIC = /\*(.*?)\*/g;
const INLINE_CODE = /`([^`]+)`/g;
const INLINE_LINK = /\[([^\]]+)]\(([^)]+)\)/g;
const INLINE_IMAGE = /!\[([^\]]*)]\(([^)]+)\)/g;

export function convertMarkdownToHtml(markdown: string): string {
  const source = markdown ?? '';
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
  return `![${alt}](${src})`;
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

  let output = escapeHtml(text);
  const codePlaceholders: string[] = [];

  const createCodePlaceholder = (code: string) => {
    const token = `__CODE_SPAN_${codePlaceholders.length}__`;
    codePlaceholders.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  };

  output = output.replace(INLINE_IMAGE, (_, alt, url) => {
    const safeAlt = escapeHtml(alt);
    const safeUrl = escapeAttribute(url);
    return `<img src="${safeUrl}" alt="${safeAlt}" />`;
  });

  output = output.replace(INLINE_LINK, (_, label, href) => {
    const safeLabel = transformInline(label);
    const safeHref = escapeAttribute(href);
    return `<a href="${safeHref}">${safeLabel}</a>`;
  });

  output = output.replace(INLINE_CODE, (_, code) => createCodePlaceholder(code));
  output = output.replace(INLINE_BOLD, (_, content) => `<strong>${transformInline(content)}</strong>`);
  output = output.replace(INLINE_ITALIC, (_, content) => `<em>${transformInline(content)}</em>`);

  if (codePlaceholders.length > 0) {
    codePlaceholders.forEach((replacement, index) => {
      const token = new RegExp(`__CODE_SPAN_${index}__`, 'g');
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
