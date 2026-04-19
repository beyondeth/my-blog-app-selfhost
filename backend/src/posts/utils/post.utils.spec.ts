import {
  collectPostImageUrls,
  extractS3KeyFromUrl,
  isManagedImageUrl,
} from "./post.utils";

describe("post.utils managed image helpers", () => {
  it("collects image URLs from both html and markdown sources", () => {
    const html =
      '<p><img src="https://cdn.codebase.blog/uploads/image/2026/04/html.png?version=1" /></p>';
    const markdown =
      '![diagram](https://cdn.codebase.blog/uploads/image/2026/04/markdown.png){#file-id}\n<img src="/api/v1/files/proxy/uploads/image/2026/04/proxy.png" />';

    expect(collectPostImageUrls(html, markdown)).toEqual([
      "https://cdn.codebase.blog/uploads/image/2026/04/html.png",
      "https://cdn.codebase.blog/uploads/image/2026/04/markdown.png",
      "/api/v1/files/proxy/uploads/image/2026/04/proxy.png",
    ]);
  });

  it("detects managed image urls and extracts their file keys", () => {
    expect(
      isManagedImageUrl(
        "https://cdn.codebase.blog/uploads/image/2026/04/sample.webp",
      ),
    ).toBe(true);
    expect(isManagedImageUrl("uploads/image/2026/04/sample.webp")).toBe(true);
    expect(
      isManagedImageUrl(
        "https://images.example.com/uploads/image/2026/04/sample.webp",
      ),
    ).toBe(false);

    expect(
      extractS3KeyFromUrl(
        "https://cdn.codebase.blog/uploads/image/2026/04/sample.webp?version=2",
      ),
    ).toBe("uploads/image/2026/04/sample.webp");
    expect(
      extractS3KeyFromUrl(
        "/api/v1/files/proxy/uploads/image/2026/04/sample.webp",
      ),
    ).toBe("uploads/image/2026/04/sample.webp");
  });
});
