import { createHash } from "crypto";
import { ViewerIdUtil } from "./viewer-id.util";

describe("ViewerIdUtil", () => {
  it("uses valid x-viewer-id header when provided", () => {
    const req = {
      headers: {
        "x-viewer-id": "viewer_abc-123:xyz",
        "user-agent": "test-agent",
      },
      ip: "127.0.0.1",
    };

    const result = ViewerIdUtil.resolve(req);
    expect(result).toBe("viewer_abc-123:xyz");
  });

  it("falls back to hash when x-viewer-id is invalid", () => {
    const req = {
      headers: {
        "x-viewer-id": "   ",
        "user-agent": "ua-1",
      },
      ip: "10.10.0.1",
    };

    const expected = createHash("sha256")
      .update("10.10.0.1|ua-1")
      .digest("hex")
      .slice(0, 48);

    expect(ViewerIdUtil.resolve(req)).toBe(expected);
  });

  it("prefers first x-forwarded-for ip when available", () => {
    const req = {
      headers: {
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "user-agent": "ua-2",
      },
      ip: "127.0.0.1",
    };

    const expected = createHash("sha256")
      .update("203.0.113.7|ua-2")
      .digest("hex")
      .slice(0, 48);

    expect(ViewerIdUtil.resolve(req)).toBe(expected);
  });
});
