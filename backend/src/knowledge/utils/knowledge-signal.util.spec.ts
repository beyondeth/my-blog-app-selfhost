import { getKnowledgeSignalTerms } from "./knowledge-signal.util";

describe("getKnowledgeSignalTerms", () => {
  it("filters low-signal tags, category duplicates, and self tags", () => {
    const result = getKnowledgeSignalTerms({
      title: "공연 기록과 확률 사고 메모",
      excerpt: "",
      category: "문화/공연",
      categorySegments: ["문화", "공연"],
      tags: ["문화", "park1818", "워크플로", "연결", "확률 사고", "윤리 기준"],
      blogAlias: "park1818",
      blogSlug: "park1818-blog",
      contentType: "markdown",
      markdown: "# Heading",
      renderedContent: "<h1>Heading</h1>",
      strippedText: "body",
      headings: ["핵심 개념", "윤리 기준"],
      outboundUrls: [],
    });

    expect(result.signalTags).toEqual(["확률 사고", "윤리 기준"]);
    expect(result.queryTokens).toEqual(
      expect.arrayContaining(["문화", "공연", "확률 사고", "윤리 기준"]),
    );
    expect(result.queryTokens).not.toEqual(
      expect.arrayContaining(["park1818", "워크플로", "연결"]),
    );
  });
});
