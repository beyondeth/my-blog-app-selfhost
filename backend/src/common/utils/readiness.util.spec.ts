import { checkReadiness } from "./readiness.util";

describe("checkReadiness", () => {
  it("reports ready only when every dependency responds", async () => {
    const result = await checkReadiness([
      { name: "database", check: async () => true },
      { name: "redis", check: async () => "PONG" },
    ]);

    expect(result).toEqual({
      ready: true,
      checks: { database: "up", redis: "up" },
    });
  });

  it("reports the failed dependency without exposing its error", async () => {
    const result = await checkReadiness([
      { name: "database", check: async () => true },
      {
        name: "redis",
        check: async () => {
          throw new Error("credential-bearing connection details");
        },
      },
    ]);

    expect(result).toEqual({
      ready: false,
      checks: { database: "up", redis: "down" },
    });
    expect(JSON.stringify(result)).not.toContain("credential-bearing");
  });
});
