import { MarkdownRendererService } from "./markdown-renderer.service";

describe("MarkdownRendererService", () => {
  let service: MarkdownRendererService;

  beforeEach(() => {
    service = new MarkdownRendererService();
  });

  it("preserves diagram fenced blocks with the language-diagram class", () => {
    const html = service.convertToHtml(
      [
        "# Diagram Sample",
        "",
        "```diagram",
        "type: flow",
        "nodes:",
        "  - id: draft",
        "    label: Draft",
        "```",
      ].join("\n"),
    );

    expect(html).toContain('<code class="language-diagram">');
    expect(html).toContain("type: flow");
    expect(html).toContain("label: Draft");
  });
});
