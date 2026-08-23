import {
  ConflictException,
  Injectable,
  UnprocessableEntityException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { LessThan, Repository } from "typeorm";
import * as crypto from "crypto";
import { RedisLockService } from "../../redis/redis-lock.service";
import { UnifiedRedisService } from "../../redis/unified-redis.service";
import {
  IdempotencyRecord,
  IdempotencyRecordStatus,
} from "../entities/idempotency-record.entity";

interface IdempotencyOptions<T> {
  scope: string;
  key: string;
  request: unknown;
  operation: () => Promise<T>;
  ttlSeconds?: number;
}

interface StoredIdempotencyResult<T> {
  requestHash: string;
  result: T;
}

/** Prevent duplicate mutations caused by retries or double-clicks. */
@Injectable()
export class IdempotencyService {
  constructor(
    private readonly redisLockService: RedisLockService,
    private readonly redisService: UnifiedRedisService,
    @InjectRepository(IdempotencyRecord)
    private readonly recordRepository: Repository<IdempotencyRecord>,
  ) {}

  async execute<T>(options: IdempotencyOptions<T>): Promise<T> {
    const key = options.key?.trim();
    if (!key || key.length > 200) {
      throw new UnprocessableEntityException(
        "Idempotency-Key must be between 1 and 200 characters",
      );
    }

    const requestHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(options.request ?? null))
      .digest("hex");
    const cacheKey = `${options.scope}:${key}`;
    const expiresAt = new Date(
      Date.now() + (options.ttlSeconds || 24 * 60 * 60) * 1000,
    );

    await this.recordRepository.delete({ expiresAt: LessThan(new Date()) });

    const cached = await this.redisService.getCache<StoredIdempotencyResult<T>>(
      "idempotency",
      cacheKey,
    );

    if (cached) {
      if (cached.requestHash !== requestHash) {
        throw new ConflictException(
          "Idempotency-Key was already used with a different request",
        );
      }
      return cached.result;
    }

    const lockResource = `idempotency:${cacheKey}`;
    const lockId = await this.redisLockService.acquireLock(lockResource, 30000);
    if (!lockId) {
      const completed = await this.redisService.getCache<
        StoredIdempotencyResult<T>
      >("idempotency", cacheKey);
      if (completed) {
        if (completed.requestHash !== requestHash) {
          throw new ConflictException(
            "Idempotency-Key was already used with a different request",
          );
        }
        return completed.result;
      }
      throw new ConflictException(
        "A request with this Idempotency-Key is in progress",
      );
    }

    let record: IdempotencyRecord | null = null;
    try {
      record = await this.recordRepository.findOne({
        where: { scope: options.scope, key },
      });

      if (record && record.requestHash !== requestHash) {
        throw new ConflictException(
          "Idempotency-Key was already used with a different request",
        );
      }

      if (record?.status === IdempotencyRecordStatus.COMPLETED) {
        return record.result as T;
      }

      if (
        record?.status === IdempotencyRecordStatus.PROCESSING &&
        record.lockedAt &&
        record.lockedAt.getTime() > Date.now() - 5 * 60 * 1000
      ) {
        throw new ConflictException(
          "A request with this Idempotency-Key is in progress",
        );
      }

      if (record) {
        record.status = IdempotencyRecordStatus.PROCESSING;
        record.lockedAt = new Date();
        record.expiresAt = expiresAt;
        await this.recordRepository.save(record);
      } else {
        record = await this.recordRepository.save(
          this.recordRepository.create({
            scope: options.scope,
            key,
            requestHash,
            status: IdempotencyRecordStatus.PROCESSING,
            result: null,
            lockedAt: new Date(),
            expiresAt,
          }),
        );
      }

      const result = await options.operation();
      record.status = IdempotencyRecordStatus.COMPLETED;
      record.result = result;
      record.lockedAt = null;
      await this.recordRepository.save(record);
      await this.redisService.setCache(
        "idempotency",
        cacheKey,
        { requestHash, result },
        options.ttlSeconds || 24 * 60 * 60,
      );
      return result;
    } catch (error) {
      if (record?.status === IdempotencyRecordStatus.PROCESSING) {
        await this.recordRepository.delete({ id: record.id });
      }
      throw error;
    } finally {
      await this.redisLockService.releaseLock(lockResource, lockId);
    }
  }
}
