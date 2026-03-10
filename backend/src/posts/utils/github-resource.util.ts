import { BadRequestException } from "@nestjs/common";
import { UrlSanitizerUtil } from "../../common/utils/url-sanitizer.util";

const ALLOWED_GITHUB_HOSTS = new Set([
  "github.com",
  "www.github.com",
  "gist.github.com",
]);

export function normalizeGithubResourceUrl(
  value?: string | null,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BadRequestException("유효한 GitHub 주소를 입력해주세요.");
  }

  if (parsed.protocol !== "https:") {
    throw new BadRequestException("GitHub 주소는 https만 지원합니다.");
  }

  if (!ALLOWED_GITHUB_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new BadRequestException("GitHub 또는 Gist 주소만 입력할 수 있습니다.");
  }

  parsed.hash = "";

  if (parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  }

  return parsed.toString();
}

export function sanitizeGithubResourceDescription(
  value?: string | null,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const sanitized = UrlSanitizerUtil.sanitizeDisplayText(value, 240)?.trim();
  return sanitized ? sanitized : null;
}
