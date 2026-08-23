import {
  resolveSessionStoreMode,
  resolveTrustedProxyAddresses,
} from "./session-config.util";

describe("session runtime policy", () => {
  it("defaults to Redis in every environment", () => {
    expect(resolveSessionStoreMode({ NODE_ENV: "development" })).toBe("redis");
    expect(resolveSessionStoreMode({ NODE_ENV: "production" })).toBe("redis");
  });

  it("allows an explicit MemoryStore only outside production", () => {
    expect(
      resolveSessionStoreMode({
        NODE_ENV: "development",
        SESSION_STORE: "memory",
      }),
    ).toBe("memory");
    expect(() =>
      resolveSessionStoreMode({
        NODE_ENV: "production",
        SESSION_STORE: "memory",
      }),
    ).toThrow(/must be redis in production/);
    expect(() =>
      resolveSessionStoreMode({
        NODE_ENV: "staging",
        SESSION_STORE: "memory",
      }),
    ).toThrow(/only in development or test/);
  });

  it("allows only explicit proxy IPs/CIDRs", () => {
    expect(
      resolveTrustedProxyAddresses({
        TRUST_PROXY_CIDRS: "127.0.0.1/32, ::1/128, 10.20.30.40",
      }),
    ).toEqual(["127.0.0.1/32", "::1/128", "10.20.30.40"]);

    for (const value of [
      "true",
      "1",
      "*",
      "0.0.0.0/0",
      "10.0.0.0/8",
      "::/0",
      "2001:db8::/32",
    ]) {
      expect(() =>
        resolveTrustedProxyAddresses({ TRUST_PROXY_CIDRS: value }),
      ).toThrow(/explicit|invalid|broad/);
    }
  });
});
