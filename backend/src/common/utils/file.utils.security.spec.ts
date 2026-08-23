import { detectImageMimeType, validateImageBuffer } from "./file.utils";

describe("image upload signature validation", () => {
  it("accepts a PNG whose signature matches the declared MIME type", () => {
    const png = Buffer.from("89504e470d0a1a0a00000000", "hex");

    expect(detectImageMimeType(png)).toBe("image/png");
    expect(
      validateImageBuffer(
        { size: png.length, mimetype: "image/png", buffer: png },
        1024,
      ),
    ).toEqual(
      expect.objectContaining({ valid: true, detectedMimeType: "image/png" }),
    );
  });

  it("rejects content that does not match the declared MIME type", () => {
    const png = Buffer.from("89504e470d0a1a0a00000000", "hex");

    expect(
      validateImageBuffer(
        { size: png.length, mimetype: "image/jpeg", buffer: png },
        1024,
      ),
    ).toEqual(expect.objectContaining({ valid: false }));
  });

  it("rejects SVG and missing image bytes", () => {
    expect(
      validateImageBuffer(
        { size: 20, mimetype: "image/svg+xml", buffer: Buffer.from("<svg />") },
        1024,
      ),
    ).toEqual(expect.objectContaining({ valid: false }));

    expect(
      validateImageBuffer({ size: 20, mimetype: "image/png" }, 1024),
    ).toEqual(expect.objectContaining({ valid: false }));
  });

  it("rejects GIF uploads under the safe default policy", () => {
    const gif = Buffer.from("474946383961000000000000", "hex");

    expect(detectImageMimeType(gif)).toBe("image/gif");
    expect(
      validateImageBuffer(
        { size: gif.length, mimetype: "image/gif", buffer: gif },
        1024,
      ),
    ).toEqual(expect.objectContaining({ valid: false }));
  });
});
