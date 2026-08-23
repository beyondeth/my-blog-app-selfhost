import { BadRequestException } from "@nestjs/common";
import { PostReadService } from "./post-read.service";

describe("PostReadService cursor contract", () => {
  const service = new PostReadService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );

  it("round-trips every sort value and the id tie-breaker", () => {
    const payload = {
      v: 1 as const,
      sortBy: "likes",
      sortOrder: "DESC" as const,
      values: [42],
      id: "00000000-0000-0000-0000-000000000001",
    };

    const encoded = (service as any).encodePostsCursor(payload);
    const decoded = (service as any).decodePostsCursor(
      encoded,
      "likes",
      "DESC",
    );

    expect(decoded).toEqual({ values: [42], id: payload.id });
  });

  it("temporarily accepts the legacy recent ISO cursor", () => {
    expect(
      (service as any).decodePostsCursor(
        "2026-08-21T00:00:00.000Z",
        "published",
        "DESC",
      ),
    ).toEqual({ values: ["2026-08-21T00:00:00.000Z"], id: null });
  });

  it("rejects a cursor issued for a different sort", () => {
    const encoded = (service as any).encodePostsCursor({
      v: 1,
      sortBy: "likes",
      sortOrder: "DESC",
      values: [42],
      id: "00000000-0000-0000-0000-000000000001",
    });

    expect(() =>
      (service as any).decodePostsCursor(encoded, "views", "DESC"),
    ).toThrow(BadRequestException);
  });
});
