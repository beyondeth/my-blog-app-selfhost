type OAuthStatePayload = {
  mobileRedirectUri?: string;
};

const DEFAULT_ALLOWED_MOBILE_SCHEMES = ["codebase", "myblog", "myblogios"];

export function parseAllowedMobileSchemes(rawValue?: string): Set<string> {
  const values = (rawValue ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (values.length === 0) {
    return new Set(DEFAULT_ALLOWED_MOBILE_SCHEMES);
  }

  return new Set(values);
}

export function sanitizeMobileRedirectUri(
  rawUri: unknown,
  allowedSchemes: Set<string>,
): string | null {
  if (typeof rawUri !== "string") {
    return null;
  }

  const trimmed = rawUri.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  const scheme = parsed.protocol.replace(":", "").toLowerCase();
  if (!scheme || scheme === "http" || scheme === "https") {
    return null;
  }

  if (!allowedSchemes.has(scheme)) {
    return null;
  }

  return parsed.toString();
}

export function encodeMobileOAuthState(mobileRedirectUri: string): string {
  const payload: OAuthStatePayload = { mobileRedirectUri };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeMobileOAuthState(
  rawState: unknown,
): OAuthStatePayload | null {
  if (typeof rawState !== "string" || !rawState.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(rawState, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}

export function appendQueryParams(
  targetUrl: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(targetUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}
