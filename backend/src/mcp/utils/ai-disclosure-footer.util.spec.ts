import {
  appendMcpAiDisclosureFooter,
  MCP_AI_DISCLOSURE_FOOTER_MARKDOWN,
} from "./ai-disclosure-footer.util";

describe("appendMcpAiDisclosureFooter", () => {
  it("appends the disclosure footer to markdown content", () => {
    const input = "## 제목\n\n본문입니다.";

    expect(appendMcpAiDisclosureFooter(input)).toBe(
      `${input}\n\n${MCP_AI_DISCLOSURE_FOOTER_MARKDOWN}`,
    );
  });

  it("does not duplicate the footer when it already exists", () => {
    const input = `## 제목\n\n본문입니다.\n\n${MCP_AI_DISCLOSURE_FOOTER_MARKDOWN}\n\n`;

    expect(appendMcpAiDisclosureFooter(input)).toBe(
      `## 제목\n\n본문입니다.\n\n${MCP_AI_DISCLOSURE_FOOTER_MARKDOWN}`,
    );
  });

  it("returns only the footer for empty content", () => {
    expect(appendMcpAiDisclosureFooter("   \n")).toBe(
      MCP_AI_DISCLOSURE_FOOTER_MARKDOWN,
    );
  });
});
