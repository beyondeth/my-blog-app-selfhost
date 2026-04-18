import { ConfigService } from "@nestjs/config";
import { KnowledgeCompileContext } from "../knowledge.types";
import { KnowledgeCompilerGatewayService } from "./knowledge-compiler-gateway.service";

describe("KnowledgeCompilerGatewayService", () => {
  const createService = (overrides: Record<string, string | undefined> = {}) =>
    new KnowledgeCompilerGatewayService({
      get: (key: string) => overrides[key],
    } as ConfigService);

  const baseContext: KnowledgeCompileContext = {
    userId: "user-1",
    blogId: "blog-1",
    postId: "post-1",
    postVersion: 1,
    contentHash: "hash",
    manifest: null,
    candidates: [],
    source: {
      title: "Next.js Cache Tags Guide",
      excerpt: "실서비스에서 캐시 태그를 다루는 방법",
      category: "개발/Frontend",
      categorySegments: ["개발", "Frontend"],
      tags: ["Next.js", "Cache Tags", "Frontend"],
      blogAlias: "park1818",
      blogSlug: "park1818",
      contentType: "markdown",
      markdown: "# Intro",
      renderedContent: "<h1>Intro</h1>",
      strippedText: "intro body",
      headings: ["Intro"],
      outboundUrls: [],
    },
  };

  it("falls back to heuristic mode when compiler env is not configured", async () => {
    const service = createService();

    const result = await service.compile(baseContext);

    expect(result.mode).toBe("heuristic");
    expect(result.primaryNodes).toHaveLength(1);
    expect(result.primaryNodes[0]).toMatchObject({
      slug: "frontend",
      title: "Frontend",
      nodeType: "topic",
      parentSlug: "개발",
    });
    expect(result.secondaryNodes.map((node) => node.slug)).toEqual(
      expect.arrayContaining(["next-js", "cache-tags"]),
    );
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromSlug: "frontend",
          toSlug: "next-js",
          relation: "followup_to",
        }),
      ]),
    );
    expect(result.postLinks.some((link) => link.role === "primary")).toBe(true);
  });

  it("does not duplicate the primary node in secondary tag nodes", async () => {
    const service = createService();

    const result = await service.compile({
      ...baseContext,
      source: {
        ...baseContext.source,
        categorySegments: ["개발"],
        tags: ["개발", "Observability"],
      },
    });

    expect(result.primaryNodes[0].slug).toBe("개발");
    expect(result.secondaryNodes.map((node) => node.slug)).not.toContain("개발");
    expect(result.followups.length).toBeLessThanOrEqual(3);
  });

  it("filters blog self tags and low-signal workflow tags from heuristic nodes", async () => {
    const service = createService();

    const result = await service.compile({
      ...baseContext,
      source: {
        ...baseContext.source,
        categorySegments: ["문화", "공연"],
        tags: ["문화", "park1818", "워크플로", "연결", "확률 사고", "윤리 기준"],
        title: "공연 기록과 확률 사고 메모",
      },
    });

    expect(result.primaryNodes[0].slug).toBe("공연");
    expect(result.secondaryNodes.map((node) => node.slug)).toEqual([
      "확률-사고",
      "윤리-기준",
    ]);
    expect(result.secondaryNodes.map((node) => node.slug)).not.toEqual(
      expect.arrayContaining(["park1818", "워크플로", "연결"]),
    );
  });

  it("maps one-segment category aliases under canonical roots instead of creating new roots", async () => {
    const service = createService();

    const result = await service.compile({
      ...baseContext,
      source: {
        ...baseContext.source,
        category: "운동",
        categorySegments: ["운동"],
        tags: ["회복", "루틴"],
        title: "운동 루틴 점검",
      },
    });

    expect(result.primaryNodes[0]).toMatchObject({
      slug: "운동",
      title: "운동",
      nodeType: "topic",
      parentSlug: "건강",
    });
  });

  it("uses a fallback topic under the generic bucket for noisy categories", async () => {
    const service = createService();

    const result = await service.compile({
      ...baseContext,
      source: {
        ...baseContext.source,
        category: "123",
        categorySegments: ["123"],
        tags: ["윤리 기준", "확률 사고"],
        title: "숫자 카테고리 테스트",
      },
    });

    expect(result.primaryNodes[0]).toMatchObject({
      slug: "윤리-기준",
      title: "윤리 기준",
      nodeType: "topic",
      parentSlug: "기타",
    });
  });

  it("keeps unknown category roots in the heuristic graph as open-world roots", async () => {
    const service = createService();

    const result = await service.compile({
      ...baseContext,
      source: {
        ...baseContext.source,
        category: "우주/관측",
        categorySegments: ["우주", "관측"],
        tags: ["망원경", "기록"],
        title: "우주 관측 기록",
      },
    });

    expect(result.primaryNodes[0]).toMatchObject({
      slug: "관측",
      title: "관측",
      nodeType: "topic",
      parentSlug: "우주",
    });
  });
});
