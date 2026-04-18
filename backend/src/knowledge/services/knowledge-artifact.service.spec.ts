import { KnowledgeArtifactService } from "./knowledge-artifact.service";

describe("KnowledgeArtifactService", () => {
  it("builds a nested section tree with section summaries from markdown", () => {
    const service = new KnowledgeArtifactService();

    const artifact = service.buildArtifact({
      source: {
        title: "건강 루틴 정리",
        excerpt: "핵심 건강 루틴",
        category: "건강/루틴",
        categorySegments: ["건강", "루틴"],
        tags: ["건강", "루틴"],
        blogSlug: "park1818",
        blogAlias: "park1818",
        contentType: "markdown",
        markdown: [
          "# 건강",
          "전체 맥락을 설명하는 도입입니다.",
          "",
          "## 윤리 기준",
          "건강 주제를 다룰 때 지켜야 할 기준과 판단 흐름을 적습니다.",
          "",
          "## 실천 루틴",
          "아침과 저녁 루틴을 정리합니다.",
          "",
          "### 회복",
          "휴식, 수면, 식단 조절의 우선순위를 다룹니다.",
        ].join("\n"),
        renderedContent: "",
        strippedText: "건강 윤리 기준 실천 루틴 회복",
        headings: ["건강", "윤리 기준", "실천 루틴", "회복"],
        outboundUrls: [],
      },
      compileResult: {
        mode: "heuristic",
        primaryNodes: [],
        secondaryNodes: [],
        edges: [],
        postLinks: [],
        followups: [],
      },
      draft: null,
    });

    expect(artifact.sectionTree).toEqual([
      expect.objectContaining({
        id: "건강-1",
        title: "건강",
        summary: expect.stringContaining("전체 맥락"),
        children: expect.arrayContaining([
          expect.objectContaining({
            id: "윤리-기준-2",
            title: "윤리 기준",
            summary: expect.stringContaining("지켜야 할 기준"),
          }),
          expect.objectContaining({
            id: "실천-루틴-3",
            title: "실천 루틴",
            children: [
              expect.objectContaining({
                id: "회복-4",
                title: "회복",
                summary: expect.stringContaining("휴식"),
              }),
            ],
          }),
        ]),
      }),
    ]);
  });
});
