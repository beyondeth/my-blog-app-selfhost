export type DocsTocItem = {
  id: string;
  label: string;
};

export function slugifyHeading(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^\w\s\-가-힣]/g, '')
    .replace(/\s+/g, '-')
    .replace(/\-+/g, '-');
}

export function extractMarkdownToc(markdown: string, maxDepth = 3): DocsTocItem[] {
  return markdown
    .split('\n')
    .map((line) => line.match(/^(#{2,3})\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .filter((match) => match[1].length <= maxDepth)
    .map((match) => ({
      id: slugifyHeading(match[2]),
      label: match[2].replace(/[`*_~]/g, '').trim(),
    }));
}
