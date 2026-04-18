import { KnowledgeCandidateGraphService } from "./knowledge-candidate-graph.service";
import { KnowledgeArtifactService } from "./knowledge-artifact.service";

describe("KnowledgeCandidateGraphService", () => {
  const createService = () =>
    new KnowledgeCandidateGraphService(
      {} as any,
      new KnowledgeArtifactService(),
    );

  it("derives open-world root/topic candidates from unknown categories", () => {
    const service = createService();

    const drafts = (service as any).buildCandidateNodeDrafts(
      {
        title: "우주 관측 기록",
        excerpt: "망원경 관측 메모",
        category: "우주/관측",
        categorySegments: ["우주", "관측"],
        tags: ["망원경", "관측"],
        blogSlug: "park1818",
        blogAlias: "park1818",
        contentType: "markdown",
        markdown: "# 우주",
        renderedContent: "<h1>우주</h1>",
        strippedText: "우주 관측",
        headings: ["우주"],
        outboundUrls: [],
      },
      {
        mode: "heuristic",
        primaryNodes: [
          {
            slug: "관측",
            title: "관측",
            nodeType: "topic",
            parentSlug: "우주",
          },
        ],
        secondaryNodes: [],
        edges: [],
        postLinks: [{ nodeSlug: "관측", role: "primary", confidence: 0.8 }],
        followups: [],
      },
      null,
    );

    expect(drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "우주",
          title: "우주",
          nodeType: "domain",
        }),
        expect.objectContaining({
          slug: "관측",
          title: "관측",
          nodeType: "topic",
          parentSlug: "우주",
        }),
      ]),
    );
  });

  it("keeps provisional nodes out of approved nodes while still falling back post links to approved parents", () => {
    const service = createService();

    const result = (service as any).buildApprovedCompileResult(
      {
        mode: "heuristic",
        primaryNodes: [
          {
            slug: "관측",
            title: "관측",
            nodeType: "topic",
            parentSlug: "우주",
          },
        ],
        secondaryNodes: [
          {
            slug: "망원경",
            title: "망원경",
            nodeType: "concept",
            parentSlug: "관측",
          },
        ],
        edges: [],
        postLinks: [
          { nodeSlug: "관측", role: "primary", confidence: 0.8 },
          { nodeSlug: "망원경", role: "secondary", confidence: 0.6 },
        ],
        followups: [],
      },
      new Set(["우주"]),
      { 우주: "우주" },
      { 관측: "우주", 망원경: "관측" },
    );

    expect(result.primaryNodes).toEqual([]);
    expect(result.secondaryNodes).toEqual([]);
    expect(result.postLinks).toEqual([
      expect.objectContaining({
        nodeSlug: "우주",
        role: "primary",
      }),
    ]);
  });

  it("attaches section refs to candidate nodes and edges from artifact sections", () => {
    const service = createService();
    const artifactService = new KnowledgeArtifactService();
    const snapshot = {
      title: "건강 기준 정리",
      excerpt: "건강 글쓰기의 기준을 정리한다",
      category: "건강/윤리 기준",
      categorySegments: ["건강", "윤리 기준"],
      tags: ["건강", "회복"],
      blogSlug: "park1818",
      blogAlias: "park1818",
      contentType: "markdown",
      markdown: [
        "# 건강",
        "건강 카테고리의 큰 흐름.",
        "",
        "## 윤리 기준",
        "무리한 일반화를 피하고 근거 수준을 명시한다.",
        "",
        "## 회복",
        "수면과 휴식을 다룬다.",
      ].join("\n"),
      renderedContent: "",
      strippedText: "건강 윤리 기준 회복",
      headings: ["건강", "윤리 기준", "회복"],
      outboundUrls: [],
    };

    const artifact = artifactService.buildArtifact({
      source: snapshot,
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
    const sectionIndex = (service as any).flattenArtifactSections(artifact.sectionTree);

    const nodeDrafts = (service as any).buildCandidateNodeDrafts(
      snapshot,
      {
        mode: "heuristic",
        primaryNodes: [
          {
            slug: "윤리-기준",
            title: "윤리 기준",
            nodeType: "topic",
            parentSlug: "건강",
          },
        ],
        secondaryNodes: [
          {
            slug: "회복",
            title: "회복",
            nodeType: "concept",
            parentSlug: "윤리-기준",
          },
        ],
        edges: [
          {
            fromSlug: "윤리-기준",
            toSlug: "회복",
            relation: "followup_to",
          },
        ],
        postLinks: [],
        followups: [],
      },
      null,
      sectionIndex,
    );

    const nodeSectionRefsBySlug = new Map(
      nodeDrafts.map((node: any) => [
        node.slug,
        node.refs.filter((ref: string) => ref.startsWith("section:")),
      ]),
    );
    const edgeDrafts = (service as any).buildCandidateEdgeDrafts(
      {
        mode: "heuristic",
        primaryNodes: [],
        secondaryNodes: [],
        edges: [
          {
            fromSlug: "윤리-기준",
            toSlug: "회복",
            relation: "followup_to",
          },
        ],
        postLinks: [],
        followups: [],
      },
      null,
      nodeSectionRefsBySlug,
    );

    expect(nodeDrafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "윤리-기준",
          refs: expect.arrayContaining(["section:윤리-기준-2"]),
        }),
        expect.objectContaining({
          slug: "회복",
          refs: expect.arrayContaining(["section:회복-3"]),
        }),
      ]),
    );
    expect(edgeDrafts).toEqual([
      expect.objectContaining({
        refs: expect.arrayContaining(["section:윤리-기준-2", "section:회복-3"]),
      }),
    ]);
  });

  it("keeps topics provisional when parent is not yet approved", async () => {
    const service = createService();
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(null),
      }),
    } as any;

    const result = await (service as any).maybeApproveCandidateNode(
      {
        userId: "user-1",
        blogId: "blog-1",
        slug: "회복",
        title: "회복",
        nodeType: "topic",
        proposedParentSlug: "건강",
        summary: "회복 주제",
        postCount: 2,
        evidence: [
          { postId: "p1", refs: ["section:회복-1"] },
          { postId: "p2", refs: ["section:회복-2"] },
        ],
      },
      manager,
    );

    expect(result).toBeNull();
  });

  it("auto-approves the first meaningful domain when only the generic root exists", async () => {
    const service = createService();
    const ensureApprovedNode = jest
      .spyOn(service as any, "ensureApprovedNode")
      .mockResolvedValue({ id: "node-1", slug: "연구노트" });
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue([
          {
            slug: "기타",
            title: "기타",
            nodeType: "domain",
            status: "active",
          },
        ]),
      }),
    } as any;

    const result = await (service as any).maybeApproveCandidateNode(
      {
        userId: "user-1",
        blogId: "blog-1",
        slug: "연구노트",
        title: "연구노트",
        nodeType: "domain",
        proposedParentSlug: null,
        summary: "연구 글 묶음",
        postCount: 1,
        evidence: [
          {
            postId: "p1",
            role: "root",
            refs: ["section:연구노트-1", "category:연구노트/계약이론"],
          },
        ],
      },
      manager,
    );

    expect(ensureApprovedNode).toHaveBeenCalledWith(
      manager,
      "user-1",
      "blog-1",
      "연구노트",
      "연구노트",
      "domain",
      null,
      "연구 글 묶음",
    );
    expect(result).toEqual({ id: "node-1", slug: "연구노트" });
  });

  it("keeps first-pass open-world domains provisional without section evidence", async () => {
    const service = createService();
    const ensureApprovedNode = jest.spyOn(service as any, "ensureApprovedNode");
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn().mockResolvedValue([
          {
            slug: "기타",
            title: "기타",
            nodeType: "domain",
            status: "active",
          },
        ]),
      }),
    } as any;

    const result = await (service as any).maybeApproveCandidateNode(
      {
        userId: "user-1",
        blogId: "blog-1",
        slug: "연구노트",
        title: "연구노트",
        nodeType: "domain",
        proposedParentSlug: null,
        summary: "연구 글 묶음",
        postCount: 1,
        evidence: [
          {
            postId: "p1",
            role: "root",
            refs: ["category:연구노트/계약이론"],
          },
        ],
      },
      manager,
    );

    expect(result).toBeNull();
    expect(ensureApprovedNode).not.toHaveBeenCalled();
  });

  it("keeps edges provisional unless both nodes are approved public relations with repeated section evidence", async () => {
    const service = createService();
    const manager = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue({ id: "node-1" }),
      }),
    } as any;

    const notEnoughEvidence = await (service as any).maybeApproveCandidateEdge(
      {
        userId: "user-1",
        relationType: "followup_to",
        fromSlug: "윤리-기준",
        toSlug: "회복",
        postCount: 2,
        evidence: [
          { postId: "p1", refs: ["section:윤리-기준-2"] },
          { postId: "p2", refs: ["edge:윤리-기준:followup_to:회복"] },
        ],
      },
      manager,
    );

    const hiddenRelation = await (service as any).maybeApproveCandidateEdge(
      {
        userId: "user-1",
        relationType: "related_to",
        fromSlug: "윤리-기준",
        toSlug: "회복",
        postCount: 2,
        evidence: [
          { postId: "p1", refs: ["section:윤리-기준-2"] },
          { postId: "p2", refs: ["section:회복-3"] },
        ],
      },
      manager,
    );

    expect(notEnoughEvidence).toBe(false);
    expect(hiddenRelation).toBe(false);
  });
});
