import { KnowledgeRebuildService } from "./knowledge-rebuild.service";

const createRepositoryMock = () => ({
  find: jest.fn(),
  save: jest.fn(),
  create: jest.fn((value) => value),
});

describe("KnowledgeRebuildService", () => {
  const createService = () => {
    const postRepository = createRepositoryMock();
    const knowledgeCompileRunRepository = createRepositoryMock();
    const redisLockService = {
      executeWithLock: jest.fn(async (_key, _ttl, callback) => callback()),
    };
    const knowledgeSourceBuilderService = {
      buildSnapshot: jest.fn(),
    };
    const knowledgeCandidateResolverService = {
      resolve: jest.fn(),
    };
    const knowledgeManifestService = {
      getOrCreate: jest.fn(),
      regenerateForUser: jest.fn(),
    };
    const knowledgeCompilerGatewayService = {
      compile: jest.fn(),
    };
    const knowledgeGraphUpsertService = {
      resetBlogKnowledgeGraph: jest.fn(),
      syncCompiledPost: jest.fn(),
      markCompileFailed: jest.fn(),
    };

    const service = new KnowledgeRebuildService(
      postRepository as any,
      knowledgeCompileRunRepository as any,
      redisLockService as any,
      knowledgeSourceBuilderService as any,
      knowledgeCandidateResolverService as any,
      knowledgeManifestService as any,
      knowledgeCompilerGatewayService as any,
      knowledgeGraphUpsertService as any,
    );

    return {
      service,
      postRepository,
      knowledgeCompileRunRepository,
      redisLockService,
      knowledgeSourceBuilderService,
      knowledgeCandidateResolverService,
      knowledgeManifestService,
      knowledgeCompilerGatewayService,
      knowledgeGraphUpsertService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("resets blog knowledge and recompiles published posts", async () => {
    const {
      service,
      postRepository,
      knowledgeCompileRunRepository,
      redisLockService,
      knowledgeSourceBuilderService,
      knowledgeCandidateResolverService,
      knowledgeManifestService,
      knowledgeCompilerGatewayService,
      knowledgeGraphUpsertService,
    } = createService();

    const allPosts = [{ id: "post-1" }, { id: "post-2" }, { id: "post-3" }];
    const publishedPosts = [
      {
        id: "post-1",
        title: "First",
        version: 3,
        metadata: { category: "건강/회복" },
      },
      {
        id: "post-2",
        title: "Second",
        version: 1,
        metadata: { category: "건강/루틴" },
      },
    ];

    postRepository.find
      .mockResolvedValueOnce(allPosts)
      .mockResolvedValueOnce(publishedPosts);
    knowledgeCompileRunRepository.save
      .mockResolvedValueOnce({ id: "run-1" })
      .mockResolvedValueOnce({ id: "run-2" });
    knowledgeSourceBuilderService.buildSnapshot
      .mockReturnValueOnce({
        snapshot: {
          title: "First",
          excerpt: "",
          category: "건강/회복",
          categorySegments: ["건강", "회복"],
          tags: [],
          contentType: "markdown",
          markdown: "",
          renderedContent: "",
          strippedText: "",
          headings: [],
          outboundUrls: [],
        },
        contentHash: "hash-1",
      })
      .mockReturnValueOnce({
        snapshot: {
          title: "Second",
          excerpt: "",
          category: "건강/루틴",
          categorySegments: ["건강", "루틴"],
          tags: [],
          contentType: "markdown",
          markdown: "",
          renderedContent: "",
          strippedText: "",
          headings: [],
          outboundUrls: [],
        },
        contentHash: "hash-2",
      });
    knowledgeManifestService.getOrCreate.mockResolvedValue({
      userId: "user-1",
      version: 1,
      generatedAt: new Date().toISOString(),
      tree: [],
      hotNodes: [],
      recentChanges: [],
      followups: [],
    });
    knowledgeManifestService.regenerateForUser.mockResolvedValue({
      userId: "user-1",
      version: 1,
      generatedAt: new Date().toISOString(),
      tree: [],
      hotNodes: [],
      recentChanges: [],
      followups: [],
    });
    knowledgeCandidateResolverService.resolve.mockResolvedValue([]);
    knowledgeCompilerGatewayService.compile.mockResolvedValue({
      mode: "heuristic",
      primaryNodes: [],
      secondaryNodes: [],
      edges: [],
      postLinks: [],
      followups: [],
    });

    const result = await service.rebuildBlog({
      id: "blog-1",
      userId: "user-1",
    });

    expect(redisLockService.executeWithLock).toHaveBeenCalledWith(
      "knowledge:user:user-1",
      120000,
      expect.any(Function),
    );
    expect(knowledgeGraphUpsertService.resetBlogKnowledgeGraph).toHaveBeenCalledWith(
      {
        userId: "user-1",
        blogId: "blog-1",
        postIds: ["post-1", "post-2", "post-3"],
      },
    );
    expect(postRepository.find).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        relations: ["metadata", "blog"],
      }),
    );
    expect(knowledgeGraphUpsertService.syncCompiledPost).toHaveBeenCalledTimes(2);
    expect(result).toEqual(
      expect.objectContaining({
        totalBlogPosts: 3,
        publishedPosts: 2,
        compiledPosts: 2,
        failedPosts: 0,
      }),
    );
  });

  it("continues rebuilding when a post compile fails", async () => {
    const {
      service,
      postRepository,
      knowledgeCompileRunRepository,
      knowledgeSourceBuilderService,
      knowledgeCandidateResolverService,
      knowledgeManifestService,
      knowledgeCompilerGatewayService,
      knowledgeGraphUpsertService,
    } = createService();

    const publishedPosts = [
      {
        id: "post-1",
        title: "First",
        version: 1,
        metadata: { category: "건강/회복" },
      },
      {
        id: "post-2",
        title: "Broken",
        version: 2,
        metadata: { category: "건강/루틴" },
      },
    ];

    postRepository.find
      .mockResolvedValueOnce(publishedPosts)
      .mockResolvedValueOnce(publishedPosts);
    knowledgeCompileRunRepository.save
      .mockResolvedValueOnce({ id: "run-1" })
      .mockResolvedValueOnce({ id: "run-2" });
    knowledgeSourceBuilderService.buildSnapshot
      .mockReturnValueOnce({
        snapshot: {
          title: "First",
          excerpt: "",
          category: "건강/회복",
          categorySegments: ["건강", "회복"],
          tags: [],
          contentType: "markdown",
          markdown: "",
          renderedContent: "",
          strippedText: "",
          headings: [],
          outboundUrls: [],
        },
        contentHash: "hash-1",
      })
      .mockReturnValueOnce({
        snapshot: {
          title: "Broken",
          excerpt: "",
          category: "건강/루틴",
          categorySegments: ["건강", "루틴"],
          tags: [],
          contentType: "markdown",
          markdown: "",
          renderedContent: "",
          strippedText: "",
          headings: [],
          outboundUrls: [],
        },
        contentHash: "hash-2",
      });
    knowledgeManifestService.getOrCreate.mockResolvedValue({
      userId: "user-1",
      version: 1,
      generatedAt: new Date().toISOString(),
      tree: [],
      hotNodes: [],
      recentChanges: [],
      followups: [],
    });
    knowledgeManifestService.regenerateForUser.mockResolvedValue({
      userId: "user-1",
      version: 1,
      generatedAt: new Date().toISOString(),
      tree: [],
      hotNodes: [],
      recentChanges: [],
      followups: [],
    });
    knowledgeCandidateResolverService.resolve.mockResolvedValue([]);
    knowledgeCompilerGatewayService.compile
      .mockResolvedValueOnce({
        mode: "heuristic",
        primaryNodes: [],
        secondaryNodes: [],
        edges: [],
        postLinks: [],
        followups: [],
      })
      .mockRejectedValueOnce(new Error("compile failed"));

    const result = await service.rebuildBlog({
      id: "blog-1",
      userId: "user-1",
    });

    expect(knowledgeGraphUpsertService.syncCompiledPost).toHaveBeenCalledTimes(1);
    expect(knowledgeGraphUpsertService.markCompileFailed).toHaveBeenCalledWith({
      compileRunId: "run-2",
      userId: "user-1",
      postId: "post-2",
      error: "compile failed",
    });
    expect(result.failedPosts).toBe(1);
    expect(result.failures).toEqual([
      expect.objectContaining({
        postId: "post-2",
        title: "Broken",
        error: "compile failed",
      }),
    ]);
  });
});
