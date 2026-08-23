import { isInternalDatabaseUrl } from "./database-url.util";

describe("isInternalDatabaseUrl", () => {
  it.each([
    "postgresql://app:password@postgres:5432/blog",
    "postgresql://app:password@pgbouncer:5432/blog",
    "postgresql://app:password@127.0.0.1:5432/blog",
  ])("recognizes %s as internal", (value) => {
    expect(isInternalDatabaseUrl(value)).toBe(true);
  });

  it("keeps external database URLs on TLS", () => {
    expect(
      isInternalDatabaseUrl(
        "postgresql://app:password@db.example.com:5432/blog",
      ),
    ).toBe(false);
  });
});
