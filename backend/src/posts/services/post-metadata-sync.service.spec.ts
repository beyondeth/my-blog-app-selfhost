import { PostMetadataSyncService } from "./post-metadata-sync.service";

describe("PostMetadataSyncService", () => {
  const service = new PostMetadataSyncService();

  it("copies canonical post fields into metadata shadow fields", () => {
    const metadata = service.syncShadowFromPost({
      id: "post-1",
      excerpt: "summary",
      tags: ["mcp", "read"],
      category: "Tech",
      content_type: "markdown",
      publishedAt: new Date("2026-03-07T00:00:00.000Z"),
      processingError: null,
      processingCompletedAt: new Date("2026-03-07T01:00:00.000Z"),
      indexedAt: new Date("2026-03-07T02:00:00.000Z"),
    });

    expect(metadata.postId).toBe("post-1");
    expect(metadata.excerpt).toBe("summary");
    expect(metadata.tags).toEqual(["mcp", "read"]);
    expect(metadata.category).toBe("Tech");
    expect(metadata.content_type).toBe("markdown");
    expect(metadata.publishedAt?.toISOString()).toBe(
      "2026-03-07T00:00:00.000Z",
    );
  });

  it("creates an empty metadata record when one is missing", () => {
    const metadata = service.ensureMetadata("post-2");

    expect(metadata.postId).toBe("post-2");
    expect(metadata.tags).toEqual([]);
  });
});
