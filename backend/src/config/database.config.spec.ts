import databaseConfig from "./database.config";

describe("database config", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
  });

  it("does not send statement_timeout to an internal PgBouncer URL", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DB_URL: "postgresql://user:password@pgbouncer:5432/blog",
      DB_STATEMENT_TIMEOUT: "30000",
    };

    const config = databaseConfig() as { extra: Record<string, unknown> };

    expect(config.extra.statement_timeout).toBeUndefined();
    expect(config.extra.query_timeout).toBe(30000);
  });

  it("keeps statement_timeout for an external PostgreSQL URL", () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      DB_URL: "postgresql://user:password@db.example.com:5432/blog",
      DB_STATEMENT_TIMEOUT: "15000",
    };

    const config = databaseConfig() as { extra: Record<string, unknown> };

    expect(config.extra.statement_timeout).toBe(15000);
  });
});
