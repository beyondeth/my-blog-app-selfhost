import { KnowledgeCompileRun } from "../entities/knowledge-compile-run.entity";
import { KnowledgeEdge } from "../entities/knowledge-edge.entity";
import { KnowledgeFollowupSuggestion } from "../entities/knowledge-followup-suggestion.entity";
import { KnowledgeNode } from "../entities/knowledge-node.entity";
import { KnowledgeSource } from "../entities/knowledge-source.entity";
import { PostKnowledgeLink } from "../entities/post-knowledge-link.entity";
import { KnowledgeGraphUpsertService } from "./knowledge-graph-upsert.service";

const createRepositoryMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  save: jest.fn(),
  create: jest.fn((value) => value),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe("KnowledgeGraphUpsertService", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes compile drafts into canonical root/topic storage shape", () => {
    const service = new KnowledgeGraphUpsertService({} as any, {
      resetBlogKnowledge: jest.fn(),
      syncCompiledKnowledge: jest.fn(),
      removePostKnowledge: jest.fn(),
    } as any);

    const normalized = (service as any).normalizeCompileResultForStorage(
      {
        title: "운동 루틴 점검",
        excerpt: "운동 루틴을 정리한 글",
        category: "운동",
        categorySegments: ["운동"],
        tags: ["회복"],
        contentType: "markdown",
        markdown: "",
        renderedContent: "",
        strippedText: "",
        headings: [],
        outboundUrls: [],
      },
      {
        mode: "llm",
        primaryNodes: [
          {
            slug: "운동",
            title: "운동",
            nodeType: "domain",
          },
        ],
        secondaryNodes: [
          {
            slug: "회복",
            title: "회복",
            nodeType: "concept",
          },
          {
            slug: "건강",
            title: "건강",
            nodeType: "concept",
          },
        ],
        edges: [
          {
            fromSlug: "건강",
            toSlug: "회복",
            relation: "followup_to",
          },
        ],
        postLinks: [{ nodeSlug: "건강", role: "primary" }],
        followups: [
          {
            title: "회복 후속 글",
            nodeSlug: "회복",
            reason: "회복도 같이 다뤘기 때문",
          },
        ],
      },
    );

    expect(normalized.primaryNodes).toEqual([
      expect.objectContaining({
        slug: "운동",
        nodeType: "topic",
        parentSlug: "건강",
      }),
    ]);
    expect(normalized.secondaryNodes.map((node) => node.slug)).toEqual(["회복"]);
    expect(normalized.edges).toEqual([
      expect.objectContaining({
        fromSlug: "운동",
        toSlug: "회복",
      }),
    ]);
    expect(normalized.postLinks).toEqual([
      expect.objectContaining({
        nodeSlug: "운동",
        role: "primary",
      }),
    ]);
  });

  it("dedupes post links by node slug and keeps the stronger role", () => {
    const service = new KnowledgeGraphUpsertService({} as any, {
      resetBlogKnowledge: jest.fn(),
      syncCompiledKnowledge: jest.fn(),
      removePostKnowledge: jest.fn(),
    } as any);

    const deduped = (service as any).dedupePostLinks([
      { nodeSlug: "건강", role: "secondary", confidence: 0.4 },
      { nodeSlug: "건강", role: "primary", confidence: 0.8 },
      { nodeSlug: "회복", role: "secondary", confidence: 0.6 },
    ]);

    expect(deduped).toEqual([
      { nodeSlug: "건강", role: "primary", confidence: 0.8 },
      { nodeSlug: "회복", role: "secondary", confidence: 0.6 },
    ]);
  });

  it("prunes orphan nodes after resetting a blog knowledge graph", async () => {
    const sourceRepo = createRepositoryMock();
    const compileRunRepo = createRepositoryMock();
    const edgeRepo = createRepositoryMock();
    const linkRepo = createRepositoryMock();
    const followupRepo = createRepositoryMock();
    const nodeRepo = createRepositoryMock();

    const sourceQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        { id: "source-1", postId: "post-1" },
      ]),
    };

    const compileDeleteQueryBuilder = {
      delete: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };

    sourceRepo.createQueryBuilder.mockReturnValue(sourceQueryBuilder);
    linkRepo.find.mockResolvedValue([{ nodeId: "node-1" }]);
    edgeRepo.delete.mockResolvedValue(undefined);
    linkRepo.delete.mockResolvedValue(undefined);
    followupRepo.delete.mockResolvedValue(undefined);
    sourceRepo.delete.mockResolvedValue(undefined);
    compileRunRepo.createQueryBuilder.mockReturnValue(compileDeleteQueryBuilder);

    const manager = {
      getRepository: jest.fn((entity) => {
        switch (entity) {
          case KnowledgeSource:
            return sourceRepo;
          case KnowledgeCompileRun:
            return compileRunRepo;
          case KnowledgeEdge:
            return edgeRepo;
          case PostKnowledgeLink:
            return linkRepo;
          case KnowledgeFollowupSuggestion:
            return followupRepo;
          case KnowledgeNode:
            return nodeRepo;
          default:
            throw new Error(`Unexpected repository request: ${entity?.name}`);
        }
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const service = new KnowledgeGraphUpsertService(dataSource as any, {
      resetBlogKnowledge: jest.fn(),
      syncCompiledKnowledge: jest.fn(),
      removePostKnowledge: jest.fn(),
    } as any);
    const recalculateSpy = jest
      .spyOn(service as any, "recalculateNodeStats")
      .mockResolvedValue(undefined);
    const pruneSpy = jest
      .spyOn(service as any, "pruneOrphanNodes")
      .mockResolvedValue(undefined);

    await service.resetBlogKnowledgeGraph({
      userId: "user-1",
      blogId: "blog-1",
      postIds: ["post-1"],
    });

    expect(recalculateSpy).toHaveBeenCalledWith(manager, ["node-1"]);
    expect(pruneSpy).toHaveBeenCalledWith(manager, "user-1");
  });

  it("prunes orphan nodes after removing post evidence", async () => {
    const sourceRepo = createRepositoryMock();
    const linkRepo = createRepositoryMock();
    const edgeRepo = createRepositoryMock();
    const followupRepo = createRepositoryMock();
    const compileRunRepo = createRepositoryMock();
    const nodeRepo = createRepositoryMock();

    sourceRepo.findOne.mockResolvedValue({ id: "source-1", status: "compiled" });
    sourceRepo.save.mockResolvedValue(undefined);
    linkRepo.find.mockResolvedValue([{ nodeId: "node-1" }, { nodeId: "node-2" }]);
    linkRepo.delete.mockResolvedValue(undefined);
    followupRepo.delete.mockResolvedValue(undefined);
    edgeRepo.delete.mockResolvedValue(undefined);

    const manager = {
      getRepository: jest.fn((entity) => {
        switch (entity) {
          case KnowledgeSource:
            return sourceRepo;
          case PostKnowledgeLink:
            return linkRepo;
          case KnowledgeEdge:
            return edgeRepo;
          case KnowledgeFollowupSuggestion:
            return followupRepo;
          case KnowledgeCompileRun:
            return compileRunRepo;
          case KnowledgeNode:
            return nodeRepo;
          default:
            throw new Error(`Unexpected repository request: ${entity?.name}`);
        }
      }),
    };

    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    const service = new KnowledgeGraphUpsertService(dataSource as any, {
      resetBlogKnowledge: jest.fn(),
      syncCompiledKnowledge: jest.fn(),
      removePostKnowledge: jest.fn(),
    } as any);
    const recalculateSpy = jest
      .spyOn(service as any, "recalculateNodeStats")
      .mockResolvedValue(undefined);
    const pruneSpy = jest
      .spyOn(service as any, "pruneOrphanNodes")
      .mockResolvedValue(undefined);

    await service.removePostEvidence({
      userId: "user-1",
      postId: "post-1",
      reason: "deleted",
    });

    expect(recalculateSpy).toHaveBeenCalledWith(manager, ["node-1", "node-2"]);
    expect(pruneSpy).toHaveBeenCalledWith(manager, "user-1");
  });
});
