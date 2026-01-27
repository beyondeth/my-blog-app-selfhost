import { parseImageAttributes, serializeImageAttributes, ImageSize } from '@/types/image-metadata.types';
import { normalizeImageAttributes } from './markdownConversion';

export type MarkdownBlock = 
  | { type: 'text'; id: string; content: string }
  | { type: 'image'; id: string; url: string; alt: string; size: ImageSize; caption?: string; fileId?: string };

// 확장 마크다운 이미지 패턴: ![alt](url){attr}
// 전역 플래그(g)를 사용하여 여러 매치를 찾음
// 라인 시작(^)과 끝($)을 사용하여 독립된 줄에 있는 이미지를 블록으로 취급하는 것이 안전하지만,
// 문단 중간에 있어도 블록으로 추출하여 보여주는 것이 시각적 에디터의 경험에 더 적합할 수 있음.
// 여기서는 일반적인 마크다운 이미지 문법을 모두 찾아서 블록으로 분리함.
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)\s*(?:\{([^}]+)\})?/g;

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return [{ type: 'text', id: 'initial', content: '' }];

  // 이미지 속성이 줄바꿈되어 있는 경우 한 줄로 병합하고 URL 괄호 처리 (ReDoS 안전)
  const normalizedMarkdown = normalizeImageAttributes(markdown);

  const blocks: MarkdownBlock[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // 정규식 상태 초기화
  IMAGE_REGEX.lastIndex = 0;

  while ((match = IMAGE_REGEX.exec(normalizedMarkdown)) !== null) {
    // 1. 이미지 앞의 텍스트를 텍스트 블록으로 추가
    if (match.index > lastIndex) {
      const textContent = normalizedMarkdown.slice(lastIndex, match.index);
      if (textContent) {
        blocks.push({
          type: 'text',
          id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: textContent,
        });
      }
    }

    // 2. 이미지 블록 추가
    const alt = match[1] || '';
    const url = match[2];
    const attrs = match[3];
    const metadata = parseImageAttributes(attrs);

    blocks.push({
      type: 'image',
      id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url,
      alt,
      size: metadata.size || 'default',
      caption: metadata.caption,
      fileId: metadata.id, // #id
    });

    lastIndex = IMAGE_REGEX.lastIndex;
  }

  // 3. 마지막 텍스트 블록 추가
  if (lastIndex < normalizedMarkdown.length) {
    const textContent = normalizedMarkdown.slice(lastIndex);
    blocks.push({
      type: 'text',
      id: `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: textContent,
    });
  }

  // 빈 텍스트 블록이 하나도 없으면 추가 (적어도 하나는 있어야 함)
  if (blocks.length === 0) {
    blocks.push({ type: 'text', id: `text-${Date.now()}`, content: '' });
  }

  return blocks;
}

export function serializeBlocks(blocks: MarkdownBlock[]): string {
  return blocks.map(block => {
    if (block.type === 'text') {
      return block.content;
    } else {
      const attrs = serializeImageAttributes({
        id: block.fileId,
        size: block.size,
        caption: block.caption
      });
      return `![${block.alt}](${block.url})${attrs}`;
    }
  }).join('');
}
