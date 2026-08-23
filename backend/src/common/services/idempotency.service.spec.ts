import { ConflictException } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";

describe("IdempotencyService", () => {
  const createRecordRepository = () => {
    const records = new Map<string, any>();
    return {
      delete: jest.fn(async () => undefined),
      findOne: jest.fn(async ({ where }: any) =>
        records.get(`${where.scope}:${where.key}`),
      ),
      create: jest.fn((value: any) => value),
      save: jest.fn(async (record: any) => {
        records.set(`${record.scope}:${record.key}`, record);
        return record;
      }),
    };
  };

  it("returns the stored response for a repeated request", async () => {
    const cache = new Map<string, any>();
    const redisService = {
      getCache: jest.fn(
        async (_namespace: string, key: string) => cache.get(key) || null,
      ),
      setCache: jest.fn(async (_namespace: string, key: string, value: any) => {
        cache.set(key, value);
      }),
    };
    const lockService = {
      acquireLock: jest.fn().mockResolvedValue("lock-id"),
      releaseLock: jest.fn().mockResolvedValue(true),
    };
    const recordRepository = createRecordRepository();
    const service = new IdempotencyService(
      lockService as any,
      redisService as any,
      recordRepository as any,
    );
    const operation = jest.fn().mockResolvedValue({ id: "post-1" });

    await expect(
      service.execute({
        scope: "posts:create:user-1",
        key: "request-1",
        request: { title: "hello" },
        operation,
      }),
    ).resolves.toEqual({ id: "post-1" });

    await expect(
      service.execute({
        scope: "posts:create:user-1",
        key: "request-1",
        request: { title: "hello" },
        operation,
      }),
    ).resolves.toEqual({ id: "post-1" });

    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("rejects reuse with a different request body", async () => {
    const stored = new Map<string, any>();
    const recordRepository = createRecordRepository();
    const service = new IdempotencyService(
      {
        acquireLock: jest.fn().mockResolvedValue("lock-id"),
        releaseLock: jest.fn().mockResolvedValue(true),
      } as any,
      {
        getCache: jest.fn(
          async (_namespace: string, key: string) => stored.get(key) || null,
        ),
        setCache: jest.fn(async (_namespace: string, key: string, value: any) =>
          stored.set(key, value),
        ),
      } as any,
      recordRepository as any,
    );

    await service.execute({
      scope: "posts:create:user-1",
      key: "request-1",
      request: { title: "hello" },
      operation: async () => ({ id: "post-1" }),
    });

    await expect(
      service.execute({
        scope: "posts:create:user-1",
        key: "request-1",
        request: { title: "different" },
        operation: async () => ({ id: "post-2" }),
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("reuses the PostgreSQL record when the Redis cache is unavailable", async () => {
    const recordRepository = createRecordRepository();
    const createService = () =>
      new IdempotencyService(
        {
          acquireLock: jest.fn().mockResolvedValue("lock-id"),
          releaseLock: jest.fn().mockResolvedValue(true),
        } as any,
        {
          getCache: jest.fn().mockResolvedValue(null),
          setCache: jest.fn().mockResolvedValue(undefined),
        } as any,
        recordRepository as any,
      );
    const operation = jest.fn().mockResolvedValue({ id: "post-1" });

    await createService().execute({
      scope: "posts:create:user-1",
      key: "request-redis-loss",
      request: { title: "hello" },
      operation,
    });

    await expect(
      createService().execute({
        scope: "posts:create:user-1",
        key: "request-redis-loss",
        request: { title: "hello" },
        operation,
      }),
    ).resolves.toEqual({ id: "post-1" });

    expect(operation).toHaveBeenCalledTimes(1);
  });
});
