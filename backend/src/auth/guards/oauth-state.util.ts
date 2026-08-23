import { randomBytes } from "crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";

export type OAuthStateProvider = "google" | "github" | "kakao";

type OAuthStateEntry = {
  provider: OAuthStateProvider;
  expiresAt: number;
  nonce?: string;
};

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_KEY = "oauthStateStore";

function getStore(req: any): Record<string, OAuthStateEntry> {
  if (!req.session) {
    throw new UnauthorizedException("OAuth session is not available");
  }

  if (!req.session[SESSION_KEY]) {
    req.session[SESSION_KEY] = {};
  }

  return req.session[SESSION_KEY] as Record<string, OAuthStateEntry>;
}

function pruneExpiredStates(store: Record<string, OAuthStateEntry>): void {
  const now = Date.now();
  for (const [state, entry] of Object.entries(store)) {
    if (!entry || entry.expiresAt <= now) {
      delete store[state];
    }
  }
}

export function issueOAuthState(
  req: any,
  provider: OAuthStateProvider,
): { state: string; nonce?: string } {
  const store = getStore(req);
  pruneExpiredStates(store);

  const state = randomBytes(24).toString("base64url");
  const nonce =
    provider === "google" ? randomBytes(24).toString("base64url") : undefined;

  store[state] = {
    provider,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
    nonce,
  };

  return { state, nonce };
}

export function consumeOAuthState(
  req: any,
  provider: OAuthStateProvider,
  state: string | undefined,
): OAuthStateEntry {
  if (!state) {
    throw new BadRequestException("Missing OAuth state");
  }

  const store = getStore(req);
  pruneExpiredStates(store);
  const entry = store[state];

  if (!entry) {
    throw new UnauthorizedException("Invalid or expired OAuth state");
  }

  delete store[state];

  if (entry.provider !== provider) {
    throw new UnauthorizedException("OAuth state provider mismatch");
  }

  if (entry.expiresAt <= Date.now()) {
    throw new UnauthorizedException("OAuth state has expired");
  }

  return entry;
}
