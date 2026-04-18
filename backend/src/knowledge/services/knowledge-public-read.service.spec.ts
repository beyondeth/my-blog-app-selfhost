import { NotFoundException } from "@nestjs/common";
import { Role } from "../../common/enums/role.enum";
import { KnowledgePublicReadService } from "./knowledge-public-read.service";

const createRepositoryMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createRawQueryBuilderMock = (rows: unknown[]) => ({
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
});

describe("KnowledgePublicReadService", () => {
  const createService = () => {
    const blogRepository = createRepositoryMock();
    const postRepository = createRepositoryMock();
    const postMetadataRepository = createRepositoryMock();
    const knowledgeNodeRepository = createRepositoryMock();
    const knowledgeEdgeRepository = createRepositoryMock();
    const knowledgeSourceRepository = createRepositoryMock();
    const postKnowledgeLinkRepository = createRepositoryMock();
    const knowledgeFollowupRepository = createRepositoryMock();

    const service = new KnowledgePublicReadService(
      blogRepository as any,
      postRepository as any,
      postMetadataRepository as any,
      knowledgeNodeRepository as any,
      knowledgeEdgeRepository as any,
      knowledgeSourceRepository as any,
      postKnowledgeLinkRepository as any,
      knowledgeFollowupRepository as any,
    );

    return {
      service,
      knowledgeNodeRepository,
      postRepository,
      postMetadataRepository,
      knowledgeEdgeRepository,
      knowledgeSourceRepository,
      postKnowledgeLinkRepository,
      knowledgeFollowupRepository,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("builds a tree with ancestor aggregation for public blog nodes", async () => {
    const { service } = createService();
    const root = {
      id: "node-root",
      slug: "web-rendering",
      title: "Web Rendering",
      canonicalPath: "web-rendering",
      summary: "root",
      nodeType: "topic",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const child = {
      id: "node-child",
      slug: "nextjs-caching",
      title: "Next.js Caching",
      canonicalPath: "web-rendering/nextjs-caching",
      summary: "child",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 3,
      postCount: 2,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [child],
      allNodesMap: new Map([
        [root.id, root],
        [child.id, child],
      ]),
      childrenMap: new Map([
        [null, [root]],
        [root.id, [child]],
      ]),
      directNodeIds: new Set([child.id]),
    });

    const result = await service.getBlogKnowledgeTree({
      id: "blog-1",
      userId: "user-1",
      isPublic: true,
    } as any);

    expect(result.nodeCount).toBe(1);
    expect(result.lastUpdatedAt).toBe("2026-04-08T10:00:00.000Z");
    expect(result.tree).toEqual([
      expect.objectContaining({
        slug: "web-rendering",
        postCount: 2,
        children: [
          expect.objectContaining({
            slug: "nextjs-caching",
            postCount: 2,
          }),
        ],
      }),
    ]);
    expect(result.hotNodes).toEqual([
      expect.objectContaining({
        slug: "nextjs-caching",
        postCount: 2,
      }),
    ]);
  });

  it("groups duplicate root categories under a single canonical root", async () => {
    const { service } = createService();
    const canonicalRoot = {
      id: "node-root-canonical",
      slug: "건강",
      title: "건강",
      canonicalPath: "/건강",
      summary: "canonical root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const legacyRoot = {
      id: "node-root-legacy",
      slug: "domain-건강-21",
      title: "건강",
      canonicalPath: "/domain-건강-21",
      summary: "legacy root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 2,
      postCount: 0,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };
    const canonicalChild = {
      id: "node-child-canonical",
      slug: "topic:건강:회복",
      title: "건강 내 회복",
      canonicalPath: "/건강/회복",
      summary: "canonical child",
      nodeType: "topic",
      parentNodeId: canonicalRoot.id,
      evidenceCount: 2,
      postCount: 2,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const legacyChild = {
      id: "node-child-legacy",
      slug: "topic-건강-legacy",
      title: "독서 기록",
      canonicalPath: "/domain-건강-21/독서-기록",
      summary: "legacy child",
      nodeType: "topic",
      parentNodeId: legacyRoot.id,
      evidenceCount: 1,
      postCount: 1,
      updatedAt: new Date("2026-04-08T07:00:00.000Z"),
    };
    const crossDomainChild = {
      id: "node-child-cross-domain",
      slug: "topic:생활:정원",
      title: "생활 내 정원",
      canonicalPath: "/생활/정원",
      summary: "cross-domain child",
      nodeType: "topic",
      parentNodeId: canonicalRoot.id,
      evidenceCount: 1,
      postCount: 1,
      updatedAt: new Date("2026-04-08T06:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [canonicalChild, legacyChild, crossDomainChild],
      allNodesMap: new Map([
        [canonicalRoot.id, canonicalRoot],
        [legacyRoot.id, legacyRoot],
        [canonicalChild.id, canonicalChild],
        [legacyChild.id, legacyChild],
        [crossDomainChild.id, crossDomainChild],
      ]),
      childrenMap: new Map([
        [null, [canonicalRoot, legacyRoot]],
        [canonicalRoot.id, [canonicalChild, crossDomainChild]],
        [legacyRoot.id, [legacyChild]],
      ]),
      directNodeIds: new Set([
        canonicalChild.id,
        legacyChild.id,
        crossDomainChild.id,
      ]),
    });

    const result = await service.getBlogKnowledgeTree({
      id: "blog-1",
      userId: "user-1",
      isPublic: true,
    } as any);

    expect(result.tree).toHaveLength(1);
    expect(result.tree[0]).toEqual(
      expect.objectContaining({
        slug: "건강",
        postCount: 4,
      }),
    );
    expect(result.tree[0].children.map((item) => item.slug)).toEqual([
      "topic:건강:회복",
    ]);
  });

  it("returns node detail with breadcrumb, children, and followups for the owner", async () => {
    const { service, knowledgeFollowupRepository } = createService();
    const root = {
      id: "node-root",
      slug: "web-rendering",
      title: "Web Rendering",
      canonicalPath: "web-rendering",
      summary: "root",
      nodeType: "topic",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const child = {
      id: "node-child",
      slug: "nextjs-caching",
      title: "Next.js Caching",
      canonicalPath: "web-rendering/nextjs-caching",
      summary: "child",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 3,
      postCount: 2,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const sibling = {
      id: "node-sibling",
      slug: "cache-tags",
      title: "Cache Tags",
      canonicalPath: "web-rendering/cache-tags",
      summary: "sibling",
      nodeType: "concept",
      parentNodeId: "node-root",
      evidenceCount: 2,
      postCount: 1,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [child, sibling],
      allNodesMap: new Map([
        [root.id, root],
        [child.id, child],
        [sibling.id, sibling],
      ]),
      childrenMap: new Map([
        [null, [root]],
        [root.id, [child, sibling]],
      ]),
      directNodeIds: new Set([child.id, sibling.id]),
    });
    (service as any).getLinkedPostsForNodes = jest.fn().mockResolvedValue([
      {
        id: "post-1",
        title: "Caching in Production",
        slug: "caching-in-production",
        createdAt: new Date("2026-04-08T07:00:00.000Z"),
        excerpt: "본문 요약",
        category: "개발/Frontend",
        blog: { slug: "park", alias: "park", name: "Park" },
      },
    ]);
    (service as any).getRelatedNodesForBlog = jest.fn().mockResolvedValue([
      {
        slug: "cache-tags",
        title: "Cache Tags",
        canonicalPath: "web-rendering/cache-tags",
        relationType: "related_to",
      },
    ]);
    knowledgeFollowupRepository.find.mockResolvedValue([
      {
        id: "followup-1",
        title: "실서비스 cache tag 운영 전략",
        reason: "후속 정리 필요",
      },
    ]);

    const result = await service.readBlogNodeDetail(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      "web-rendering",
      {
        id: "user-1",
        role: Role.USER,
      } as any,
    );

    expect(result.breadcrumb.map((item) => item.slug)).toEqual([
      "web-rendering",
    ]);
    expect(result.node.postCount).toBe(3);
    expect(result.childNodes.map((item) => item.slug)).toEqual([
      "nextjs-caching",
      "cache-tags",
    ]);
    expect(result.childNodes.map((item) => item.postCount)).toEqual([2, 1]);
    expect(result.posts).toHaveLength(1);
    expect(result.followups).toEqual([
      expect.objectContaining({
        title: "실서비스 cache tag 운영 전략",
      }),
    ]);
  });

  it("hides followups from public node detail responses", async () => {
    const { service, knowledgeFollowupRepository } = createService();
    const root = {
      id: "node-root",
      slug: "web-rendering",
      title: "Web Rendering",
      canonicalPath: "web-rendering",
      summary: "root",
      nodeType: "topic",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [root],
      allNodesMap: new Map([[root.id, root]]),
      childrenMap: new Map([[null, [root]]]),
      directNodeIds: new Set([root.id]),
    });
    (service as any).getLinkedPostsForNodes = jest.fn().mockResolvedValue([]);
    (service as any).getRelatedNodesForBlog = jest.fn().mockResolvedValue([]);

    const result = await service.readBlogNodeDetail(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      "web-rendering",
    );

    expect(result.followups).toEqual([]);
    expect(knowledgeFollowupRepository.find).not.toHaveBeenCalled();
  });

  it("aggregates root detail across duplicate category family members", async () => {
    const { service, knowledgeFollowupRepository } = createService();
    const canonicalRoot = {
      id: "node-root-canonical",
      slug: "건강",
      title: "건강",
      canonicalPath: "/건강",
      summary: "canonical root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const legacyRoot = {
      id: "node-root-legacy",
      slug: "domain-건강-21",
      title: "건강",
      canonicalPath: "/domain-건강-21",
      summary: "legacy root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 2,
      postCount: 0,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };
    const canonicalChild = {
      id: "node-child-canonical",
      slug: "topic:건강:회복",
      title: "건강 내 회복",
      canonicalPath: "/건강/회복",
      summary: "canonical child",
      nodeType: "topic",
      parentNodeId: canonicalRoot.id,
      evidenceCount: 2,
      postCount: 2,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const legacyChild = {
      id: "node-child-legacy",
      slug: "topic-건강-legacy",
      title: "독서 기록",
      canonicalPath: "/domain-건강-21/독서-기록",
      summary: "legacy child",
      nodeType: "topic",
      parentNodeId: legacyRoot.id,
      evidenceCount: 1,
      postCount: 1,
      updatedAt: new Date("2026-04-08T07:00:00.000Z"),
    };
    const crossDomainChild = {
      id: "node-child-cross-domain",
      slug: "topic:생활:정원",
      title: "생활 내 정원",
      canonicalPath: "/생활/정원",
      summary: "cross-domain child",
      nodeType: "topic",
      parentNodeId: canonicalRoot.id,
      evidenceCount: 1,
      postCount: 1,
      updatedAt: new Date("2026-04-08T06:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [canonicalChild, legacyChild, crossDomainChild],
      allNodesMap: new Map([
        [canonicalRoot.id, canonicalRoot],
        [legacyRoot.id, legacyRoot],
        [canonicalChild.id, canonicalChild],
        [legacyChild.id, legacyChild],
        [crossDomainChild.id, crossDomainChild],
      ]),
      childrenMap: new Map([
        [null, [canonicalRoot, legacyRoot]],
        [canonicalRoot.id, [canonicalChild, crossDomainChild]],
        [legacyRoot.id, [legacyChild]],
      ]),
      directNodeIds: new Set([
        canonicalChild.id,
        legacyChild.id,
        crossDomainChild.id,
      ]),
    });
    const linkedPostsSpy = jest
      .spyOn(service as any, "getLinkedPostsForNodes")
      .mockResolvedValue([
        {
          id: "post-1",
          title: "회복 루틴",
          slug: "recovery-routine",
          createdAt: new Date("2026-04-08T07:00:00.000Z"),
          excerpt: "본문 요약",
          category: "건강",
          blog: { slug: "park", alias: "park", name: "Park" },
        },
      ]);
    const relatedNodesSpy = jest
      .spyOn(service as any, "getRelatedNodesForBlog")
      .mockResolvedValue([]);
    knowledgeFollowupRepository.find.mockResolvedValue([]);

    const result = await service.readBlogNodeDetail(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      "domain-건강-21",
    );

    expect(linkedPostsSpy).toHaveBeenCalledWith(
      expect.anything(),
      ["node-root-canonical", "node-root-legacy"],
      false,
    );
    expect(relatedNodesSpy).toHaveBeenCalledWith(
      "user-1",
      ["node-root-canonical", "node-root-legacy"],
      expect.anything(),
    );
    expect(result.node).toEqual(
      expect.objectContaining({
        slug: "건강",
        postCount: 4,
      }),
    );
    expect(result.childNodes.map((item) => item.slug)).toEqual([
      "topic:건강:회복",
    ]);
  });

  it("builds a local knowledge map with explicit public relations only", async () => {
    const { service } = createService();
    const root = {
      id: "node-root",
      slug: "web-rendering",
      title: "Web Rendering",
      canonicalPath: "web-rendering",
      summary: "root",
      nodeType: "topic",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const child = {
      id: "node-child",
      slug: "nextjs-caching",
      title: "Next.js Caching",
      canonicalPath: "web-rendering/nextjs-caching",
      summary: "child",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 3,
      postCount: 2,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const sibling = {
      id: "node-sibling",
      slug: "cache-tags",
      title: "Cache Tags",
      canonicalPath: "web-rendering/cache-tags",
      summary: "sibling",
      nodeType: "concept",
      parentNodeId: "node-root",
      evidenceCount: 2,
      postCount: 1,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [child, sibling],
      allNodesMap: new Map([
        [root.id, root],
        [child.id, child],
        [sibling.id, sibling],
      ]),
      childrenMap: new Map([
        [null, [root]],
        [root.id, [child, sibling]],
      ]),
      directNodeIds: new Set([child.id, sibling.id]),
    });
    (service as any).knowledgeEdgeRepository.find = jest.fn().mockResolvedValue([
      {
        fromNodeId: child.id,
        toNodeId: sibling.id,
        relationType: "prerequisite_of",
        confidence: 0.91,
        reason: "Explicit relation",
        evidenceCount: 3,
        updatedAt: new Date("2026-04-08T11:00:00.000Z"),
      },
    ]);

    const result = await service.getBlogKnowledgeMap(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      undefined,
      "nextjs-caching",
      12,
    );

    expect(result.focusNode).toEqual(
      expect.objectContaining({
        slug: "nextjs-caching",
      }),
    );
    expect(result.edges).toEqual([
      expect.objectContaining({
        fromSlug: "nextjs-caching",
        toSlug: "cache-tags",
        relationType: "prerequisite_of",
      }),
    ]);
    expect(result.hasExplicitEdges).toBe(true);
    expect(result.nodes.map((item) => item.slug)).toEqual([
      "nextjs-caching",
      "cache-tags",
    ]);
    expect(result.contextNodes).toEqual([
      expect.objectContaining({
        slug: "web-rendering",
        contextType: "parent",
      }),
    ]);
  });

  it("returns context halo nodes when a focus node has no explicit public relations", async () => {
    const { service } = createService();
    const root = {
      id: "node-root",
      slug: "문화",
      title: "카테고리: 문화",
      canonicalPath: "/문화",
      summary: "root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 6,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const childA = {
      id: "node-child-a",
      slug: "topic:문화:전시",
      title: "문화 내 전시",
      canonicalPath: "/문화/전시",
      summary: "child a",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 4,
      postCount: 3,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const childB = {
      id: "node-child-b",
      slug: "topic:문화:영화",
      title: "문화 내 영화",
      canonicalPath: "/문화/영화",
      summary: "child b",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 3,
      postCount: 2,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };
    const childC = {
      id: "node-child-c",
      slug: "topic:생활:산책",
      title: "생활 내 산책",
      canonicalPath: "/생활/산책",
      summary: "hot fallback",
      nodeType: "topic",
      parentNodeId: null,
      evidenceCount: 2,
      postCount: 1,
      updatedAt: new Date("2026-04-08T07:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [childA, childB, childC],
      allNodesMap: new Map([
        [root.id, root],
        [childA.id, childA],
        [childB.id, childB],
        [childC.id, childC],
      ]),
      childrenMap: new Map([
        [null, [root, childC]],
        [root.id, [childA, childB]],
      ]),
      directNodeIds: new Set([childA.id, childB.id, childC.id]),
    });
    (service as any).knowledgeEdgeRepository.find = jest.fn().mockResolvedValue([]);

    const result = await service.getBlogKnowledgeMap(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      undefined,
      "문화",
      12,
    );

    expect(result.focusNode).toEqual(
      expect.objectContaining({
        slug: "문화",
      }),
    );
    expect(result.requestedFocusSlug).toBe("문화");
    expect(result.resolvedFocusSlug).toBe("문화");
    expect(result.requestedFocusFound).toBe(true);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toEqual([]);
    expect(result.hasExplicitEdges).toBe(false);
    expect(result.contextNodes).toEqual([
      expect.objectContaining({
        slug: "topic:문화:전시",
        contextType: "child",
      }),
      expect.objectContaining({
        slug: "topic:문화:영화",
        contextType: "child",
      }),
      expect.objectContaining({
        slug: "topic:생활:산책",
        contextType: "hot",
      }),
    ]);
  });

  it("falls back to the hottest node when the requested focus slug no longer exists", async () => {
    const { service } = createService();
    const root = {
      id: "node-root",
      slug: "문화",
      title: "문화",
      canonicalPath: "문화",
      summary: "root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 6,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const child = {
      id: "node-child",
      slug: "공연",
      title: "공연",
      canonicalPath: "문화/공연",
      summary: "child",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 4,
      postCount: 3,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [child],
      allNodesMap: new Map([
        [root.id, root],
        [child.id, child],
      ]),
      childrenMap: new Map([
        [null, [root]],
        [root.id, [child]],
      ]),
      directNodeIds: new Set([child.id]),
    });
    (service as any).knowledgeEdgeRepository.find = jest.fn().mockResolvedValue([]);

    const result = await service.getBlogKnowledgeMap(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      undefined,
      "park1818",
      12,
    );

    expect(result.requestedFocusSlug).toBe("park1818");
    expect(result.requestedFocusFound).toBe(false);
    expect(result.resolvedFocusSlug).toBe("공연");
    expect(result.focusNode).toEqual(
      expect.objectContaining({
        slug: "공연",
      }),
    );
  });

  it("builds a truth-first knowledge canvas with provenance and owner-only insights", async () => {
    const {
      service,
      postRepository,
      postMetadataRepository,
      knowledgeEdgeRepository,
      knowledgeSourceRepository,
      postKnowledgeLinkRepository,
      knowledgeFollowupRepository,
    } = createService();
    const root = {
      id: "node-root",
      slug: "domain:개발",
      title: "카테고리: 개발",
      canonicalPath: "/개발",
      summary: "root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 6,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const child = {
      id: "node-child",
      slug: "backend",
      title: "Backend",
      canonicalPath: "/개발/backend",
      summary: "child",
      nodeType: "topic",
      parentNodeId: "node-root",
      evidenceCount: 4,
      postCount: 3,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const grandchild = {
      id: "node-grandchild",
      slug: "api-contract",
      title: "API Contract",
      canonicalPath: "/개발/backend/api-contract",
      summary: "grandchild",
      nodeType: "concept",
      parentNodeId: "node-child",
      evidenceCount: 3,
      postCount: 2,
      updatedAt: new Date("2026-04-08T11:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [child, grandchild],
      allNodesMap: new Map([
        [root.id, root],
        [child.id, child],
        [grandchild.id, grandchild],
      ]),
      childrenMap: new Map([
        [null, [root]],
        [root.id, [child]],
        [child.id, [grandchild]],
      ]),
      directNodeIds: new Set([child.id, grandchild.id]),
    });

    knowledgeEdgeRepository.find.mockResolvedValue([
      {
        id: "edge-1",
        userId: "user-1",
        sourceId: "source-1",
        fromNodeId: child.id,
        toNodeId: grandchild.id,
        relationType: "followup_to",
        confidence: 0.83,
        reason: "실제 연속 글 흐름",
        evidenceCount: 2,
      },
    ]);
    knowledgeSourceRepository.find.mockResolvedValue([
      {
        id: "source-1",
        userId: "user-1",
        blogId: "blog-1",
        postId: "post-2",
      },
    ]);
    postKnowledgeLinkRepository.find.mockResolvedValue([
      {
        postId: "post-1",
        nodeId: child.id,
      },
      {
        postId: "post-2",
        nodeId: grandchild.id,
      },
    ]);
    postRepository.find.mockResolvedValue([
      {
        id: "post-1",
        title: "Backend 기초",
        slug: "backend-basics",
        visibility: "public",
        isDeleted: false,
        isPublished: true,
        status: "published",
        createdAt: new Date("2026-04-07T09:00:00.000Z"),
        thumbnailImageId: null,
        blog: {
          slug: "park1818",
          alias: "park1818",
          name: "Park",
        },
      },
      {
        id: "post-2",
        title: "API Contract 설계",
        slug: "api-contract-design",
        visibility: "public",
        isDeleted: false,
        isPublished: true,
        status: "published",
        createdAt: new Date("2026-04-08T09:00:00.000Z"),
        thumbnailImageId: null,
        blog: {
          slug: "park1818",
          alias: "park1818",
          name: "Park",
        },
      },
    ]);
    postMetadataRepository.find.mockResolvedValue([
      {
        postId: "post-1",
        excerpt: "backend intro",
        category: "개발",
      },
      {
        postId: "post-2",
        excerpt: "contract detail",
        category: "개발",
      },
    ]);
    knowledgeFollowupRepository.find.mockResolvedValue([
      {
        id: "followup-1",
        title: "다음 글 초안",
        reason: "owner insight",
        status: "pending",
        nodeId: child.id,
        postId: null,
      },
    ]);

    const result = await service.getBlogKnowledgeCanvas(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      {
        id: "user-1",
        role: Role.USER,
      } as any,
      "backend",
      36,
    );

    expect(result.rootNode).toEqual(
      expect.objectContaining({
        slug: "domain:개발",
        depth: 0,
      }),
    );
    expect(result.focusNode).toEqual(
      expect.objectContaining({
        slug: "backend",
      }),
    );
    expect(result.pathFromRoot.map((item) => item.slug)).toEqual([
      "domain:개발",
      "backend",
    ]);
    expect(result.treeEdges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromSlug: "domain:개발",
          toSlug: "backend",
        }),
      ]),
    );
    expect(result.factEdges).toEqual([
      expect.objectContaining({
        fromSlug: "backend",
        toSlug: "api-contract",
        relationType: "followup_to",
      }),
    ]);
    expect(result.provenance.nodes.backend.posts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "post-1",
          title: "Backend 기초",
        }),
      ]),
    );
    expect(result.provenance.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeKey: "backend::followup_to::api-contract",
          posts: [
            expect.objectContaining({
              id: "post-2",
              title: "API Contract 설계",
            }),
          ],
        }),
      ]),
    );
    expect(result.viewerCanSeeInsights).toBe(true);
    expect(result.insights?.followups).toEqual([
      expect.objectContaining({
        title: "다음 글 초안",
      }),
    ]);
  });

  it("keeps canvas insights hidden for public viewers", async () => {
    const {
      service,
      knowledgeEdgeRepository,
      knowledgeSourceRepository,
      postKnowledgeLinkRepository,
      postRepository,
      postMetadataRepository,
      knowledgeFollowupRepository,
    } = createService();
    const root = {
      id: "node-root",
      slug: "개발",
      title: "개발",
      canonicalPath: "/개발",
      summary: "root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 3,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [root],
      allNodesMap: new Map([[root.id, root]]),
      childrenMap: new Map([[null, [root]]]),
      directNodeIds: new Set([root.id]),
    });
    knowledgeEdgeRepository.find.mockResolvedValue([]);
    knowledgeSourceRepository.find.mockResolvedValue([]);
    postKnowledgeLinkRepository.find.mockResolvedValue([]);
    postRepository.find.mockResolvedValue([]);
    postMetadataRepository.find.mockResolvedValue([]);

    const result = await service.getBlogKnowledgeCanvas(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      undefined,
      "개발",
      36,
    );

    expect(result.viewerCanSeeInsights).toBe(false);
    expect(result.insights).toBeNull();
    expect(knowledgeFollowupRepository.find).not.toHaveBeenCalled();
  });

  it("builds a truth-first flow board projection for the public map page", async () => {
    const {
      service,
      knowledgeEdgeRepository,
    } = createService();
    const root = {
      id: "node-root",
      slug: "domain:개발",
      title: "카테고리: 개발",
      canonicalPath: "/개발",
      summary: "개발 루트",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const focus = {
      id: "node-focus",
      slug: "backend",
      title: "백엔드",
      canonicalPath: "/개발/백엔드",
      summary: "백엔드 핵심 주제",
      nodeType: "topic",
      parentNodeId: root.id,
      evidenceCount: 6,
      postCount: 3,
      updatedAt: new Date("2026-04-08T10:00:00.000Z"),
    };
    const child = {
      id: "node-child",
      slug: "api-contract",
      title: "API Contract",
      canonicalPath: "/개발/백엔드/api-contract",
      summary: "하위 주제",
      nodeType: "concept",
      parentNodeId: focus.id,
      evidenceCount: 3,
      postCount: 2,
      updatedAt: new Date("2026-04-08T11:00:00.000Z"),
    };
    const prerequisite = {
      id: "node-prerequisite",
      slug: "http-basics",
      title: "HTTP Basics",
      canonicalPath: "/개발/http-basics",
      summary: "먼저 읽기",
      nodeType: "concept",
      parentNodeId: root.id,
      evidenceCount: 2,
      postCount: 1,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };
    const followup = {
      id: "node-followup",
      slug: "backend-scale",
      title: "Backend Scale",
      canonicalPath: "/개발/백엔드/backend-scale",
      summary: "이어 읽기",
      nodeType: "topic",
      parentNodeId: focus.id,
      evidenceCount: 2,
      postCount: 1,
      updatedAt: new Date("2026-04-08T12:00:00.000Z"),
    };
    const duplicate = {
      id: "node-duplicate",
      slug: "server-runtime",
      title: "Server Runtime",
      canonicalPath: "/개발/백엔드/server-runtime",
      summary: "같이 보기",
      nodeType: "topic",
      parentNodeId: focus.id,
      evidenceCount: 1,
      postCount: 1,
      updatedAt: new Date("2026-04-08T07:00:00.000Z"),
    };

    (service as any).getBlogNodeProjection = jest.fn().mockResolvedValue({
      directNodes: [focus, child, prerequisite, followup, duplicate],
      allNodesMap: new Map([
        [root.id, root],
        [focus.id, focus],
        [child.id, child],
        [prerequisite.id, prerequisite],
        [followup.id, followup],
        [duplicate.id, duplicate],
      ]),
      childrenMap: new Map([
        [null, [root]],
        [root.id, [focus, prerequisite]],
        [focus.id, [child, followup, duplicate]],
      ]),
      directNodeIds: new Set([
        focus.id,
        child.id,
        prerequisite.id,
        followup.id,
        duplicate.id,
      ]),
    });

    knowledgeEdgeRepository.find.mockResolvedValue([
      {
        fromNodeId: prerequisite.id,
        toNodeId: focus.id,
        relationType: "prerequisite_of",
        evidenceCount: 2,
        sourceId: "source-1",
      },
      {
        fromNodeId: focus.id,
        toNodeId: followup.id,
        relationType: "followup_to",
        evidenceCount: 3,
        sourceId: "source-2",
      },
      {
        fromNodeId: focus.id,
        toNodeId: duplicate.id,
        relationType: "duplicate_of",
        evidenceCount: 1,
        sourceId: "source-3",
      },
    ]);

    (service as any).getLinkedPostsForNodes = jest
      .fn()
      .mockImplementation(async (_blog, nodeIds: string[]) => {
        const deduped = Array.from(new Set(nodeIds));
        if (deduped.includes(focus.id) || deduped.includes(child.id)) {
          return [
            {
              id: "post-1",
              title: "Backend 기초",
              slug: "backend-basic",
              createdAt: new Date("2026-04-08T09:00:00.000Z"),
              excerpt: "backend output",
              category: "개발",
              thumbnail: null,
              blog: {
                slug: "park1818",
                alias: "park1818",
                name: "Park",
              },
            },
          ];
        }

        if (deduped.includes(prerequisite.id)) {
          return [
            {
              id: "post-2",
              title: "HTTP 기초",
              slug: "http-basic",
              createdAt: new Date("2026-04-08T08:00:00.000Z"),
              excerpt: "http output",
              category: "개발",
              thumbnail: null,
              blog: {
                slug: "park1818",
                alias: "park1818",
                name: "Park",
              },
            },
          ];
        }

        return [];
      });

    const result = await service.getBlogKnowledgeFlowBoard(
      {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      } as any,
      {
        id: "user-1",
        role: Role.USER,
      } as any,
      "backend",
      24,
    );

    expect(result.rootPath.map((item) => item.slug)).toEqual([
      "domain:개발",
      "backend",
    ]);
    expect(result.focus).toEqual(
      expect.objectContaining({
        slug: "backend",
        kind: "focus",
      }),
    );
    expect(result.primaryFlow?.title).toBe("핵심 구조");
    expect(result.primaryFlow?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "api-contract", kind: "child" }),
        expect.objectContaining({ slug: "backend-scale", kind: "child" }),
        expect.objectContaining({ slug: "server-runtime", kind: "child" }),
      ]),
    );
    expect(result.primaryFlow?.evidencePosts).toEqual([
      expect.objectContaining({
        id: "post-1",
        title: "Backend 기초",
      }),
    ]);
    expect(result.detailPanels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "먼저 보면 좋은 주제",
          layoutHint: "right",
          evidencePosts: [
            expect.objectContaining({
              id: "post-2",
              title: "HTTP 기초",
            }),
          ],
        }),
      ]),
    );
    expect(result.detailPanels.find((panel) => panel.id === "root-path")).toBeUndefined();
    expect(result.detailPanels.find((panel) => panel.id === "followups")).toBeUndefined();
    expect(result).not.toHaveProperty("outputs");
  });

  it("blocks private post knowledge context for anonymous viewers", async () => {
    const { service, postRepository, postKnowledgeLinkRepository } = createService();

    postRepository.findOne.mockResolvedValue({
      id: "post-1",
      isDeleted: false,
      isPublished: true,
      status: "published",
      visibility: "private",
      blog: {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      },
    });

    await expect(service.getPostKnowledgeContext("post-1")).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    postKnowledgeLinkRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    await expect(
      service.getPostKnowledgeContext("post-1", {
        id: "user-1",
        role: Role.USER,
      } as any),
    ).resolves.toEqual(
      expect.objectContaining({
        breadcrumb: [],
        canonicalPath: null,
      }),
    );
  });

  it("builds post knowledge context from a targeted projection without loading the whole blog map", async () => {
    const {
      service,
      postRepository,
      postKnowledgeLinkRepository,
      knowledgeNodeRepository,
      knowledgeEdgeRepository,
    } = createService();
    const root = {
      id: "node-root",
      slug: "web-rendering",
      title: "Web Rendering",
      canonicalPath: "web-rendering",
      summary: "root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };

    postRepository.findOne.mockResolvedValue({
      id: "post-1",
      isDeleted: false,
      isPublished: true,
      status: "published",
      visibility: "public",
      blog: {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      },
    });
    postKnowledgeLinkRepository.createQueryBuilder
      .mockReturnValueOnce(
        createRawQueryBuilderMock([
          {
            role: "primary",
            id: "node-child",
            slug: "nextjs-caching",
            title: "Next.js Caching",
            canonicalPath: "web-rendering/nextjs-caching",
            summary: "child",
          },
        ]),
      )
      .mockReturnValueOnce(
        createRawQueryBuilderMock([
          {
            id: "node-child",
            slug: "nextjs-caching",
            title: "Next.js Caching",
            canonicalPath: "web-rendering/nextjs-caching",
            summary: "child",
            nodeType: "topic",
            parentNodeId: "node-root",
            evidenceCount: 3,
            postCount: 2,
            updatedAt: "2026-04-08T10:00:00.000Z",
          },
        ]),
      )
      .mockReturnValueOnce(createRawQueryBuilderMock([]));
    knowledgeNodeRepository.find
      .mockResolvedValueOnce([root])
      .mockResolvedValueOnce([root]);
    knowledgeEdgeRepository.find.mockResolvedValue([]);

    const fullProjectionSpy = jest.spyOn(service as any, "getBlogNodeProjection");

    await expect(
      service.getPostKnowledgeContext("post-1", {
        id: "user-1",
        role: Role.USER,
      } as any),
    ).resolves.toEqual({
      breadcrumb: [
        {
          slug: "web-rendering",
          title: "Web Rendering",
          canonicalPath: "web-rendering",
        },
        {
          slug: "nextjs-caching",
          title: "Next.js Caching",
          canonicalPath: "web-rendering/nextjs-caching",
        },
      ],
      canonicalPath: "web-rendering/nextjs-caching",
      primaryNodes: [
        {
          slug: "nextjs-caching",
          title: "Next.js Caching",
          canonicalPath: "web-rendering/nextjs-caching",
          summary: "child",
        },
      ],
      secondaryNodes: [],
      relatedNodes: [],
    });

    expect(fullProjectionSpy).not.toHaveBeenCalled();
  });

  it("canonicalizes duplicate root families in post knowledge context", async () => {
    const {
      service,
      postRepository,
      postKnowledgeLinkRepository,
      knowledgeNodeRepository,
      knowledgeEdgeRepository,
    } = createService();
    const canonicalRoot = {
      id: "node-root-canonical",
      slug: "건강",
      title: "건강",
      canonicalPath: "/건강",
      summary: "canonical root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 5,
      postCount: 0,
      updatedAt: new Date("2026-04-08T09:00:00.000Z"),
    };
    const legacyRoot = {
      id: "node-root-legacy",
      slug: "domain-건강-21",
      title: "건강",
      canonicalPath: "/domain-건강-21",
      summary: "legacy root",
      nodeType: "domain",
      parentNodeId: null,
      evidenceCount: 2,
      postCount: 1,
      updatedAt: new Date("2026-04-08T08:00:00.000Z"),
    };

    postRepository.findOne.mockResolvedValue({
      id: "post-2",
      isDeleted: false,
      isPublished: true,
      status: "published",
      visibility: "public",
      blog: {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      },
    });
    postKnowledgeLinkRepository.createQueryBuilder
      .mockReturnValueOnce(
        createRawQueryBuilderMock([
          {
            role: "primary",
            id: "node-root-legacy",
            slug: "domain-건강-21",
            title: "건강",
            canonicalPath: "/domain-건강-21",
            summary: "legacy root",
          },
        ]),
      )
      .mockReturnValueOnce(
        createRawQueryBuilderMock([
          {
            id: "node-root-legacy",
            slug: "domain-건강-21",
            title: "건강",
            canonicalPath: "/domain-건강-21",
            summary: "legacy root",
            nodeType: "domain",
            parentNodeId: null,
            evidenceCount: 2,
            postCount: 1,
            updatedAt: "2026-04-08T08:00:00.000Z",
          },
        ]),
      )
      .mockReturnValueOnce(createRawQueryBuilderMock([]));
    knowledgeNodeRepository.find.mockResolvedValueOnce([
      canonicalRoot,
      legacyRoot,
    ]);
    knowledgeEdgeRepository.find.mockResolvedValue([]);

    const result = await service.getPostKnowledgeContext("post-2", {
      id: "user-1",
      role: Role.USER,
    } as any);

    expect(result.breadcrumb).toEqual([
      {
        slug: "건강",
        title: "건강",
        canonicalPath: "/건강",
      },
    ]);
    expect(result.primaryNodes).toEqual([
      {
        slug: "건강",
        title: "건강",
        canonicalPath: "/건강",
        summary: "canonical root",
      },
    ]);
  });

  it("guards post knowledge context breadcrumbs against parent cycles", async () => {
    const {
      service,
      postRepository,
      postKnowledgeLinkRepository,
      knowledgeNodeRepository,
      knowledgeEdgeRepository,
    } = createService();

    postRepository.findOne.mockResolvedValue({
      id: "post-cycle",
      isDeleted: false,
      isPublished: true,
      status: "published",
      visibility: "public",
      blog: {
        id: "blog-1",
        userId: "user-1",
        isPublic: true,
      },
    });
    postKnowledgeLinkRepository.createQueryBuilder
      .mockReturnValueOnce(
        createRawQueryBuilderMock([
          {
            role: "primary",
            id: "node-cycle",
            slug: "개발",
            title: "디버깅",
            canonicalPath: "개발/개발",
            summary: "cycle node",
          },
        ]),
      )
      .mockReturnValueOnce(
        createRawQueryBuilderMock([
          {
            id: "node-cycle",
            slug: "개발",
            title: "디버깅",
            canonicalPath: "개발/개발",
            summary: "cycle node",
            nodeType: "topic",
            parentNodeId: "node-cycle",
            evidenceCount: 2,
            postCount: 1,
            updatedAt: "2026-04-12T02:47:23.490Z",
          },
        ]),
      )
      .mockReturnValueOnce(createRawQueryBuilderMock([]));
    knowledgeNodeRepository.find.mockResolvedValue([]);
    knowledgeEdgeRepository.find.mockResolvedValue([]);

    const result = await service.getPostKnowledgeContext("post-cycle", {
      id: "user-1",
      role: Role.USER,
    } as any);

    expect(result.breadcrumb).toEqual([
      {
        slug: "개발",
        title: "디버깅",
        canonicalPath: "개발/개발",
      },
    ]);
    expect(result.primaryNodes).toEqual([
      {
        slug: "개발",
        title: "디버깅",
        canonicalPath: "개발/개발",
        summary: "cycle node",
      },
    ]);
  });
});
