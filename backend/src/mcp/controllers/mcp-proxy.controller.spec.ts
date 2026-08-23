import { BadRequestException } from "@nestjs/common";
import { McpProxyController } from "./mcp-proxy.controller";

jest.mock("nanoid", () => ({
  customAlphabet: () => () => "mocked-api-key",
}));

describe("McpProxyController image contract", () => {
  const postsService = {
    createFast: jest.fn(),
  };
  const userRepository = {
    findOne: jest.fn(),
  };
  const usageService = {
    trackMcpPost: jest.fn(),
  };
  const externalImageDownloadService = {
    extractExternalImageUrls: jest.fn(),
  };
  const filesService = {
    createUploadUrl: jest.fn(),
    uploadComplete: jest.fn(),
  };

  let controller: McpProxyController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new McpProxyController(
      postsService as any,
      userRepository as any,
      usageService as any,
      externalImageDownloadService as any,
      filesService as any,
    );
  });

  it("passes the authenticated owner scope to the signed upload service", async () => {
    filesService.createUploadUrl.mockResolvedValue({
      uploadUrl: "https://storage.example/upload",
      tempId: "signed-intent",
      fileKey: "uploads/image/generated.webp",
    });

    const result = await controller.createImageUploadUrl(
      { apiKey: { userId: "user-1", organizationId: "org-1" } },
      {
        fileName: "generated.webp",
        mimeType: "image/webp",
        fileSize: 1024,
        fileType: "image",
      },
    );

    expect(filesService.createUploadUrl).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ mimeType: "image/webp", fileSize: 1024 }),
      "org-1",
    );
    expect(result).toEqual({
      uploadUrl: "https://storage.example/upload",
      tempId: "signed-intent",
      fileKey: "uploads/image/generated.webp",
      fileName: "generated.webp",
      mimeType: "image/webp",
      fileSize: 1024,
    });
  });

  it("returns the persisted file ID and URL after signed completion", async () => {
    filesService.uploadComplete.mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000001",
      originalName: "generated.webp",
      fileKey: "uploads/image/generated.webp",
      mimeType: "image/webp",
      fileSize: 1024,
      accessUrl: "/api/v1/files/proxy/uploads/image/generated.webp",
    });
    const completion = {
      tempId: "signed-intent",
      fileKey: "uploads/image/generated.webp",
      fileUrl: "uploads/image/generated.webp",
      fileName: "generated.webp",
      mimeType: "image/webp",
      fileSize: 1024,
      fileType: "image",
    };

    const result = await controller.completeImageUpload(
      { apiKey: { userId: "user-1", organizationId: "org-1" } },
      completion,
    );

    expect(filesService.uploadComplete).toHaveBeenCalledWith(
      "user-1",
      completion,
      "org-1",
    );
    expect(result).toEqual({
      fileId: "00000000-0000-4000-8000-000000000001",
      publicUrl: "/api/v1/files/proxy/uploads/image/generated.webp",
      descriptor: {
        id: "00000000-0000-4000-8000-000000000001",
        fileKey: "uploads/image/generated.webp",
        fileName: "generated.webp",
        mimeType: "image/webp",
        fileSize: 1024,
      },
    });
  });

  it("rejects non-WebP MCP image requests before issuing an intent", async () => {
    await expect(
      controller.createImageUploadUrl(
        { apiKey: { userId: "user-1", organizationId: "org-1" } },
        {
          fileName: "generated.png",
          mimeType: "image/png",
          fileSize: 1024,
          fileType: "image",
        },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(filesService.createUploadUrl).not.toHaveBeenCalled();
  });

  it("attaches finalized file IDs and validates the thumbnail through the same owner-scoped path", async () => {
    userRepository.findOne.mockResolvedValue({ id: "user-1" });
    externalImageDownloadService.extractExternalImageUrls.mockReturnValue([]);
    postsService.createFast.mockResolvedValue({
      id: "post-1",
      slug: "post-slug",
      title: "Post",
      tags: [],
      blog: { slug: "blog" },
    });
    usageService.trackMcpPost.mockResolvedValue(undefined);

    await controller.createPost(
      { apiKey: { userId: "user-1", organizationId: "org-1" } },
      {
        title: "Post",
        content_markdown: "## Content",
        category: "Tech",
        attachedFileIds: ["00000000-0000-4000-8000-000000000001"],
        thumbnailImageId: "00000000-0000-4000-8000-000000000002",
      },
    );

    expect(postsService.createFast).toHaveBeenCalledWith(
      expect.objectContaining({
        attachedFileIds: [
          "00000000-0000-4000-8000-000000000001",
          "00000000-0000-4000-8000-000000000002",
        ],
        thumbnailImageId: "00000000-0000-4000-8000-000000000002",
      }),
      { id: "user-1" },
      "org-1",
    );
  });
});
