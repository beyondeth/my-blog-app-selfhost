import type { SessionData } from "express-session";
import {
  getSessionTtlSeconds,
  RedisSessionStore,
  SessionRedisClient,
} from "./redis-session.store";

describe("RedisSessionStore", () => {
  const sessionData = (maxAge = 60_000): SessionData =>
    ({ cookie: { maxAge } }) as SessionData;

  it("stores, reads, touches and destroys sessions in the shared namespace", async () => {
    const values = new Map<string, unknown>();
    const ttls: number[] = [];
    const redis: SessionRedisClient = {
      async set(key, value, _expiryMode, ttl) {
        values.set(key, value);
        ttls.push(ttl);
      },
      async get(key) {
        return (values.get(key) as string) || null;
      },
      async del(key) {
        values.delete(key);
      },
    };
    const writer = new RedisSessionStore(redis);
    const reader = new RedisSessionStore(redis);

    await new Promise<void>((resolve, reject) =>
      writer.set("sid", sessionData(), (error) =>
        error ? reject(error) : resolve(),
      ),
    );
    await expect(
      new Promise<SessionData | null>((resolve, reject) =>
        reader.get("sid", (error, value) =>
          error ? reject(error) : resolve(value),
        ),
      ),
    ).resolves.toEqual(sessionData());

    await new Promise<void>((resolve, reject) =>
      reader.touch("sid", sessionData(120_000), (error) =>
        error ? reject(error) : resolve(),
      ),
    );
    expect(ttls).toEqual([60, 120]);

    await new Promise<void>((resolve, reject) =>
      writer.destroy("sid", (error) => (error ? reject(error) : resolve())),
    );
    await expect(
      new Promise<SessionData | null>((resolve, reject) =>
        reader.get("sid", (error, value) =>
          error ? reject(error) : resolve(value),
        ),
      ),
    ).resolves.toBeNull();
  });

  it("derives Redis TTL from the cookie and falls back safely", () => {
    expect(getSessionTtlSeconds(sessionData(1_001))).toBe(2);
    expect(getSessionTtlSeconds({ cookie: {} } as SessionData)).toBe(60 * 60);
  });

  it("propagates Redis write failures through the Store callback", async () => {
    const redis: SessionRedisClient = {
      async set() {
        throw new Error("redis unavailable");
      },
      async get() {
        return null;
      },
      async del() {},
    };
    const store = new RedisSessionStore(redis);

    await expect(
      new Promise<void>((resolve, reject) =>
        store.set("sid", sessionData(), (error) =>
          error ? reject(error) : resolve(),
        ),
      ),
    ).rejects.toThrow("redis unavailable");
  });
});
