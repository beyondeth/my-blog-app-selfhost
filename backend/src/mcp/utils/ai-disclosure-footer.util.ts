export const MCP_AI_DISCLOSURE_FOOTER_TEXT =
  "이 글은 생성형 AI를 활용해 작성되었습니다.";

export const MCP_AI_DISCLOSURE_FOOTER_MARKDOWN = `---\n\n> ${MCP_AI_DISCLOSURE_FOOTER_TEXT}`;

export function appendMcpAiDisclosureFooter(markdown: string): string {
  const normalizedContent = markdown.trimEnd();

  if (!normalizedContent) {
    return MCP_AI_DISCLOSURE_FOOTER_MARKDOWN;
  }

  if (normalizedContent.endsWith(MCP_AI_DISCLOSURE_FOOTER_MARKDOWN)) {
    return normalizedContent;
  }

  return `${normalizedContent}\n\n${MCP_AI_DISCLOSURE_FOOTER_MARKDOWN}`;
}
