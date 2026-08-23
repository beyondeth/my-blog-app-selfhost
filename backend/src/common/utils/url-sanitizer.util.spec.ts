import { UrlSanitizerUtil } from "./url-sanitizer.util";

describe("UrlSanitizerUtil.sanitizeFilePath", () => {
  it("preserves nested object-storage key segments", () => {
    expect(
      UrlSanitizerUtil.sanitizeFilePath(
        "v2/communities/community-id/branding/banner/image.png",
      ),
    ).toBe("v2/communities/community-id/branding/banner/image.png");

    expect(
      UrlSanitizerUtil.sanitizeFilePath("uploads/2026/08/image.webp"),
    ).toBe("uploads/2026/08/image.webp");
  });

  it("rejects traversal and invalid path segments", () => {
    expect(UrlSanitizerUtil.sanitizeFilePath("uploads/../secret.png")).toBe("");
    expect(UrlSanitizerUtil.sanitizeFilePath("uploads/%2e%2e/secret.png")).toBe(
      "",
    );
    expect(UrlSanitizerUtil.sanitizeFilePath("uploads/image name.png")).toBe(
      "",
    );
  });
});
