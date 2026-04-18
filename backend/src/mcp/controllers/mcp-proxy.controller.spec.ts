jest.mock("nanoid", () => ({
  customAlphabet: () => () => "abcd1234",
}));

import { McpProxyController } from "./mcp-proxy.controller";
import { appendMcpAiDisclosureFooter } from "../utils/ai-disclosure-footer.util";
import { MCP_RAW_MERMAID_ERROR_MESSAGE } from "../../common/utils/legacy-mermaid.util";

describe("McpProxyController", () => {
  const createController = () => {
    const postsService = {
      createFast: jest.fn(),
      findMyPublishedPostsForMcp: jest.fn(),
      findMyPublishedPostForMcp: jest.fn(),
    };
    const userRepository = {
      findOne: jest.fn(),
    };
    const blogRepository = {
      findOne: jest.fn(),
    };
    const usageService = {
      checkMcpPostLimit: jest.fn(),
      trackMcpPost: jest.fn(),
    };
    const externalImageDownloadService = {
      extractExternalImageUrls: jest.fn(),
      downloadExternalImages: jest.fn(),
      replaceImageUrls: jest.fn(),
      removeFailedImages: jest.fn(),
    };
    const filesService = {};
    const knowledgeQueryService = {
      getManifest: jest.fn(),
      searchNodes: jest.fn(),
      readNode: jest.fn(),
      listFollowups: jest.fn(),
      dismissFollowup: jest.fn(),
    };

    const dataSource = { getRepository: jest.fn() };

    const controller = new McpProxyController(
      postsService as any,
      userRepository as any,
      blogRepository as any,
      usageService as any,
      externalImageDownloadService as any,
      filesService as any,
      dataSource as any,
      knowledgeQueryService as any,
    );

    return {
      controller,
      postsService,
      userRepository,
      blogRepository,
      usageService,
      externalImageDownloadService,
    };
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("appends the AI disclosure footer before creating an MCP post", async () => {
    const {
      controller,
      postsService,
      userRepository,
      blogRepository,
      usageService,
      externalImageDownloadService,
    } = createController();

    blogRepository.findOne.mockResolvedValue({
      id: "blog-1",
      isPublic: true,
      userId: "user-1",
    });
    usageService.checkMcpPostLimit.mockResolvedValue({ canPost: true });
    usageService.trackMcpPost.mockResolvedValue(undefined);
    userRepository.findOne.mockResolvedValue({ id: "user-1" });
    externalImageDownloadService.extractExternalImageUrls.mockReturnValue([]);
    postsService.createFast.mockResolvedValue({
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      blog: { slug: "codebase", isPublic: true },
      isPublished: true,
      visibility: "public",
      effectiveVisibility: "public",
      visibilityBlockedByBlogPrivacy: false,
    });

    const result = await controller.createPost(
      { apiKey: { userId: "user-1", blogId: "blog-1" } },
      {
        title: "Hello World",
        content_markdown: "## Hello\n\n본문입니다.",
        category: "Tech",
        tags: ["mcp"],
      } as any,
    );

    expect(postsService.createFast).toHaveBeenCalledWith(
      expect.objectContaining({
        content_markdown:
          appendMcpAiDisclosureFooter("## Hello\n\n본문입니다."),
        visibility: "public",
        tags: ["mcp"],
        category: "Tech",
      }),
      expect.objectContaining({ id: "user-1" }),
    );
    expect(result).toMatchObject({
      id: "post-1",
      slug: "hello-world",
      title: "Hello World",
      url: "/codebase/hello-world",
      blog: { slug: "codebase", isPublic: true },
      isPublished: true,
      visibility: "public",
      effectiveVisibility: "public",
      visibilityBlockedByBlogPrivacy: false,
      _meta: expect.objectContaining({
        status: "created",
      }),
    });
  });

  it("keeps a pre-existing AI disclosure footer idempotent", async () => {
    const {
      controller,
      postsService,
      userRepository,
      blogRepository,
      usageService,
      externalImageDownloadService,
    } = createController();

    const contentWithFooter = appendMcpAiDisclosureFooter(
      "## Hello\n\n이미 footer가 있습니다.",
    );

    blogRepository.findOne.mockResolvedValue({
      id: "blog-1",
      isPublic: false,
      userId: "user-1",
    });
    usageService.checkMcpPostLimit.mockResolvedValue({ canPost: true });
    usageService.trackMcpPost.mockResolvedValue(undefined);
    userRepository.findOne.mockResolvedValue({ id: "user-1" });
    externalImageDownloadService.extractExternalImageUrls.mockReturnValue([]);
    postsService.createFast.mockResolvedValue({
      id: "post-2",
      slug: "already-footer",
      title: "Already Footer",
      blog: { slug: "codebase" },
    });

    await controller.createPost(
      { apiKey: { userId: "user-1", blogId: "blog-1" } },
      {
        title: "Already Footer",
        content_markdown: `${contentWithFooter}\n\n`,
        category: "Tech",
      } as any,
    );

    expect(postsService.createFast).toHaveBeenCalledWith(
      expect.objectContaining({
        content_markdown: contentWithFooter,
        visibility: "private",
      }),
      expect.objectContaining({ id: "user-1" }),
    );
  });

  it("returns effective private visibility when blog privacy overrides a public post", async () => {
    const {
      controller,
      postsService,
      userRepository,
      blogRepository,
      usageService,
      externalImageDownloadService,
    } = createController();

    blogRepository.findOne.mockResolvedValue({
      id: "blog-1",
      isPublic: false,
      userId: "user-1",
    });
    usageService.checkMcpPostLimit.mockResolvedValue({ canPost: true });
    usageService.trackMcpPost.mockResolvedValue(undefined);
    userRepository.findOne.mockResolvedValue({ id: "user-1" });
    externalImageDownloadService.extractExternalImageUrls.mockReturnValue([]);
    postsService.createFast.mockResolvedValue({
      id: "post-3",
      slug: "private-blog-post",
      title: "Private Blog Post",
      blog: { slug: "codebase", alias: "codebase", isPublic: false },
      isPublished: true,
      visibility: "public",
      effectiveVisibility: "private",
      visibilityBlockedByBlogPrivacy: true,
    });

    const result = await controller.createPost(
      { apiKey: { userId: "user-1", blogId: "blog-1" } },
      {
        title: "Private Blog Post",
        content_markdown: "본문",
        category: "Tech",
        visibility: "public",
      } as any,
    );

    expect(result).toMatchObject({
      id: "post-3",
      slug: "private-blog-post",
      title: "Private Blog Post",
      url: "/codebase/private-blog-post",
      blog: { alias: "codebase", isPublic: false },
      isPublished: true,
      visibility: "public",
      effectiveVisibility: "private",
      visibilityBlockedByBlogPrivacy: true,
      _meta: expect.objectContaining({
        status: "created",
      }),
    });
  });

  it("rejects raw Mermaid fenced blocks on the direct MCP create path", async () => {
    const { controller, postsService } = createController();

    await expect(
      controller.createPost(
        { apiKey: { userId: "user-1", blogId: "blog-1" } },
        {
          title: "Legacy Mermaid",
          content_markdown: [
            "## Diagram",
            "",
            "```mermaid",
            "flowchart LR",
            "A[시작] --> B[끝]",
            "```",
          ].join("\n"),
          category: "Tech",
        } as any,
      ),
    ).rejects.toThrow(MCP_RAW_MERMAID_ERROR_MESSAGE);

    expect(postsService.createFast).not.toHaveBeenCalled();
  });

  it("lists only the authenticated user's published posts for MCP read", async () => {
    const { controller, postsService } = createController();

    postsService.findMyPublishedPostsForMcp.mockResolvedValue({
      items: [{ id: "post-1", title: "Published", slug: "published" }],
      total: 1,
      page: 1,
      limit: 20,
    });

    const result = await controller.listPublishedPosts(
      { apiKey: { userId: "user-1", blogId: "blog-1" } },
      "1",
      "20",
      "react",
      "Tech",
      "mcp",
      "2026-01-01",
      "2026-03-01",
    );

    expect(postsService.findMyPublishedPostsForMcp).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        page: 1,
        limit: 20,
        search: "react",
        category: "Tech",
        tag: "mcp",
        dateFrom: "2026-01-01",
        dateTo: "2026-03-01",
      }),
    );
    expect(result.total).toBe(1);
  });

  it("reads a single published post for the authenticated MCP user", async () => {
    const { controller, postsService } = createController();

    postsService.findMyPublishedPostForMcp.mockResolvedValue({
      id: "post-9",
      title: "Deep dive",
      slug: "deep-dive",
    });

    const result = await controller.readPublishedPost(
      { apiKey: { userId: "user-1", blogId: "blog-1" } },
      "post-9",
    );

    expect(postsService.findMyPublishedPostForMcp).toHaveBeenCalledWith(
      "user-1",
      "post-9",
    );
    expect(result.slug).toBe("deep-dive");
  });
});
