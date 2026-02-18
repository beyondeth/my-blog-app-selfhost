import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type OAuthStatePayload = {
  mobileRedirectUri?: string;
  rid?: string;
  iat?: number;
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

export function encodeMobileOAuthState(
  mobileRedirectUri: string,
  secret?: string,
): string {
  const payload: OAuthStatePayload = {
    mobileRedirectUri,
    rid: randomRequestId(),
    iat: Date.now(),
  };
  const encodedPayload = Buffer.from(
    JSON.stringify(payload),
    "utf8",
  ).toString("base64url");

  if (!secret || !secret.trim()) {
    return encodedPayload;
  }

  const signature = signStatePayload(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function decodeMobileOAuthState(
  rawState: unknown,
  secret?: string,
): OAuthStatePayload | null {
  if (typeof rawState !== "string" || !rawState.trim()) {
    return null;
  }

  const trimmed = rawState.trim();
  const [encodedPayload, signature] = trimmed.split(".", 2);
  const payloadForDecode = encodedPayload || trimmed;

  if (secret && signature) {
    const expected = signStatePayload(payloadForDecode, secret);
    if (!safeEqual(signature, expected)) {
      return null;
    }
  }

  try {
    const decoded = Buffer.from(payloadForDecode, "base64url").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed as OAuthStatePayload;
  } catch {
    return null;
  }
}

function signStatePayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return timingSafeEqual(aBuffer, bBuffer);
}

function randomRequestId(): string {
  return randomBytes(12).toString("hex");
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
