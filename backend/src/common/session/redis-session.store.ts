import * as session from "express-session";

export interface SessionRedisClient {
  get(key: string): Promise<string | null>;
  set(
    key: string,
    value: string,
    expiryMode: "EX",
    ttl: number,
  ): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

const SESSION_KEY_PREFIX = "http-session:";
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60;

export function getSessionTtlSeconds(sessionData: session.SessionData): number {
  const maxAge = sessionData.cookie?.maxAge;
  if (typeof maxAge === "number" && Number.isFinite(maxAge) && maxAge > 0) {
    return Math.max(1, Math.ceil(maxAge / 1000));
  }

  const expires = sessionData.cookie?.expires;
  if (expires) {
    const remaining = new Date(expires).getTime() - Date.now();
    if (Number.isFinite(remaining) && remaining > 0) {
      return Math.max(1, Math.ceil(remaining / 1000));
    }
  }

  return DEFAULT_SESSION_TTL_SECONDS;
}

/**
 * express-session Store backed by the application's existing Redis service.
 */
export class RedisSessionStore extends session.Store {
  constructor(private readonly redis: SessionRedisClient) {
    super();
  }

  get(
    sid: string,
    callback: (error: unknown, value?: session.SessionData | null) => void,
  ): void {
    void this.redis
      .get(`${SESSION_KEY_PREFIX}${sid}`)
      .then((value) =>
        callback(
          null,
          value ? (JSON.parse(value) as session.SessionData) : null,
        ),
      )
      .catch((error) => callback(error));
  }

  set(
    sid: string,
    sessionData: session.SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    void this.redis
      .set(
        `${SESSION_KEY_PREFIX}${sid}`,
        JSON.stringify(sessionData),
        "EX",
        getSessionTtlSeconds(sessionData),
      )
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  destroy(sid: string, callback?: (error?: unknown) => void): void {
    void this.redis
      .del(`${SESSION_KEY_PREFIX}${sid}`)
      .then(() => callback?.())
      .catch((error) => callback?.(error));
  }

  touch(
    sid: string,
    sessionData: session.SessionData,
    callback?: (error?: unknown) => void,
  ): void {
    this.set(sid, sessionData, callback);
  }
}
