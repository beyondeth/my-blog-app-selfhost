const INTERNAL_DATABASE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "postgres",
  "pgbouncer",
]);

export function isInternalDatabaseUrl(value: string): boolean {
  try {
    return INTERNAL_DATABASE_HOSTS.has(new URL(value).hostname.toLowerCase());
  } catch {
    return /@(localhost|127\.0\.0\.1|postgres|pgbouncer)(?::|\/|$)/i.test(
      value,
    );
  }
}
