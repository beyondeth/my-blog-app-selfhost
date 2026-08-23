import { normalizeProxyFileKey } from "./file-proxy.util";

describe("normalizeProxyFileKey", () => {
  it("joins wildcard route segments without losing nested keys", () => {
    expect(
      normalizeProxyFileKey(["uploads", "image", "2026", "08", "cover.webp"]),
    ).toBe("uploads/image/2026/08/cover.webp");
  });

  it("keeps a string wildcard value unchanged", () => {
    expect(normalizeProxyFileKey("uploads/image.webp")).toBe(
      "uploads/image.webp",
    );
  });

  it("returns an empty value for an unavailable route parameter", () => {
    expect(normalizeProxyFileKey(undefined)).toBe("");
  });
});
