/**
 * Treat the two common local browser hostnames as the same explicit origin.
 * This keeps self-hosted development convenient without introducing a
 * wildcard origin for credentialed requests.
 */
export function expandLoopbackOrigins(origins: string[]): string[] {
  const expanded = new Set<string>();

  for (const rawOrigin of origins) {
    const origin = rawOrigin.trim();
    if (!origin) continue;

    expanded.add(origin);

    try {
      const parsed = new URL(origin);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      if (parsed.hostname === "localhost") {
        parsed.hostname = "127.0.0.1";
        expanded.add(parsed.origin);
      } else if (parsed.hostname === "127.0.0.1") {
        parsed.hostname = "localhost";
        expanded.add(parsed.origin);
      }
    } catch {
      // Invalid origins are left in the list for the normal exact-match path.
    }
  }

  return [...expanded];
}
