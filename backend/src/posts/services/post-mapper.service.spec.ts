import { PostMapperService } from "./post-mapper.service";

describe("PostMapperService image batching", () => {
  it("loads all post images with one ordered query", async () => {
    const filesRepository = {
      query: jest.fn().mockResolvedValue([
        {
          postId: "00000000-0000-0000-0000-000000000001",
          id: "00000000-0000-0000-0000-000000000011",
          fileKey: "uploads/image/first.webp",
        },
        {
          postId: "00000000-0000-0000-0000-000000000001",
          id: "00000000-0000-0000-0000-000000000012",
          fileKey: "uploads/image/second.webp",
        },
      ]),
    };
    const service = new PostMapperService(
      filesRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.getAttachedImageFilesByPostIds([
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002",
    ]);

    expect(filesRepository.query).toHaveBeenCalledTimes(1);
    expect(filesRepository.query.mock.calls[0][0]).toContain("image_order");
    expect(
      result
        .get("00000000-0000-0000-0000-000000000001")
        ?.map((file) => file.fileKey),
    ).toEqual(["uploads/image/first.webp", "uploads/image/second.webp"]);
    expect(result.get("00000000-0000-0000-0000-000000000002")).toEqual([]);
  });

  it("uses the canonical attached image as the fallback thumbnail", async () => {
    const cdnService = {
      generateCdnUrlFromKey: jest.fn(
        (key: string) => `https://cdn.aigory.com/${key}`,
      ),
    };
    const service = new PostMapperService(
      {} as any,
      {} as any,
      {} as any,
      cdnService as any,
      {} as any,
    );
    const attachedImage = {
      id: "00000000-0000-0000-0000-000000000011",
      fileName: "example.webp",
      originalName: "example.webp",
      fileKey: "uploads/image/2026/08/example.webp",
      fileUrl:
        "http://localhost:3000/api/v1/files/proxy/uploads/image/2026/08/example.webp",
      fileSize: 100,
      mimeType: "image/webp",
      fileType: "image",
      createdAt: new Date("2026-08-24T00:00:00.000Z"),
      updatedAt: new Date("2026-08-24T00:00:00.000Z"),
    };
    const post = {
      id: "00000000-0000-0000-0000-000000000001",
      title: "Post",
      excerpt: "",
      category: "",
      tags: [],
      content:
        '<p><img src="http://localhost:3000/api/v1/files/proxy/uploads/image/2026/08/example.webp"></p>',
      content_markdown: "",
      thumbnailImageId: null,
      attachedFiles: [attachedImage],
    };

    const result = await service.toPostDto(post as any);

    expect(result.images).toEqual([
      "https://cdn.aigory.com/uploads/image/2026/08/example.webp",
    ]);
    expect(result.thumbnail).toBe(
      "https://cdn.aigory.com/uploads/image/2026/08/example.webp",
    );
  });
});
