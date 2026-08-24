import { normalizeCdnBaseUrl } from "./cdn-url.util";

describe("normalizeCdnBaseUrl", () => {
  it.each([
    ["cdn.aigory.com", "https://cdn.aigory.com"],
    ["https://cdn.aigory.com/", "https://cdn.aigory.com"],
    ["http://localhost:8787/assets/", "http://localhost:8787/assets"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeCdnBaseUrl(input)).toBe(expected);
  });

  it.each(["", "ftp://cdn.example.com", "https://user:pass@cdn.example.com"])(
    "rejects an unusable CDN base: %s",
    (input) => {
      expect(normalizeCdnBaseUrl(input)).toBe("");
    },
  );
});
