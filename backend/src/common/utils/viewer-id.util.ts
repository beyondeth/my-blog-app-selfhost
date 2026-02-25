import { createHash } from "crypto";

type RequestLike = {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
};

const MAX_VIEWER_ID_LENGTH = 128;
const VIEWER_ID_PATTERN = /^[a-zA-Z0-9:_-]{8,128}$/;

function normalizeHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function sanitizeViewerId(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_VIEWER_ID_LENGTH) {
    return undefined;
  }
  if (!VIEWER_ID_PATTERN.test(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function extractClientIp(req: RequestLike): string {
  const forwardedFor = normalizeHeaderValue(req.headers?.["x-forwarded-for"]);
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }

  return req.ip || "";
}

export class ViewerIdUtil {
  static resolve(req: RequestLike): string {
    const rawViewerId = normalizeHeaderValue(req.headers?.["x-viewer-id"]);
    const viewerId = sanitizeViewerId(rawViewerId);
    if (viewerId) {
      return viewerId;
    }

    const ip = extractClientIp(req) || "unknown-ip";
    const userAgent =
      normalizeHeaderValue(req.headers?.["user-agent"]) || "unknown-ua";

    return createHash("sha256")
      .update(`${ip}|${userAgent}`)
      .digest("hex")
      .slice(0, 48);
  }
}
