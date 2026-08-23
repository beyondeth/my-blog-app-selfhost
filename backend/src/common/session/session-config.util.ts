import * as ipaddr from "ipaddr.js";

export type SessionStoreMode = "redis" | "memory";

export function resolveSessionStoreMode(
  environment: NodeJS.ProcessEnv = process.env,
): SessionStoreMode {
  const mode = (environment.SESSION_STORE || "redis").trim().toLowerCase();
  if (mode !== "redis" && mode !== "memory") {
    throw new Error("SESSION_STORE must be either redis or memory");
  }

  if (environment.NODE_ENV === "production" && mode !== "redis") {
    throw new Error("SESSION_STORE must be redis in production");
  }

  if (
    mode === "memory" &&
    !["development", "test"].includes(environment.NODE_ENV || "")
  ) {
    throw new Error(
      "SESSION_STORE=memory is available only in development or test",
    );
  }

  return mode;
}

/**
 * Express proxy trust accepts only explicitly configured IP addresses/CIDRs.
 * Boolean, numeric-hop and universal-network shortcuts are deliberately not
 * supported because they let direct clients spoof forwarded headers.
 */
export function resolveTrustedProxyAddresses(
  environment: NodeJS.ProcessEnv = process.env,
): string[] {
  const entries = (environment.TRUST_PROXY_CIDRS || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const entry of entries) {
    if (/^(?:true|false|\*|\d+)$/i.test(entry)) {
      throw new Error(
        "TRUST_PROXY_CIDRS accepts explicit IP addresses or CIDRs only",
      );
    }

    try {
      if (entry.includes("/")) {
        const [address, prefixLength] = ipaddr.parseCIDR(entry);
        const minimumPrefixLength = address.kind() === "ipv4" ? 24 : 64;
        if (prefixLength < minimumPrefixLength) {
          throw new Error("proxy network is too broad");
        }
      } else {
        ipaddr.parse(entry);
      }
    } catch {
      throw new Error(
        "TRUST_PROXY_CIDRS contains an invalid or overly broad address range",
      );
    }
  }

  return [...new Set(entries)];
}
