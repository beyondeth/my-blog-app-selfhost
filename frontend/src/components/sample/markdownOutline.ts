import React from 'react';

export interface MarkdownHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

export function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_[\]()#:+.!?,]/g, '')
    .replace(/[^0-9a-z가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function extractMarkdownHeadings(markdown: string): MarkdownHeading[] {
  return markdown
    .split('\n')
    .map((line) => line.match(/^(#{1,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const level = match[1].length as 1 | 2 | 3;
      const text = match[2].trim();
      return {
        id: slugifyHeading(text),
        text,
        level,
      };
    });
}

export function flattenReactText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') {
    return '';
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenReactText).join('');
  }

  if (React.isValidElement(node)) {
    return flattenReactText((node.props as { children?: React.ReactNode }).children);
  }

  return '';
}

export function estimateReadingMinutes(markdown: string): number {
  const wordCount = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(wordCount / 220));
}

export function countMarkdownTables(markdown: string): number {
  const separatorRows = markdown.match(/^\|(?:\s*:?-+:?\s*\|)+\s*$/gm);
  return separatorRows?.length ?? 0;
}
