import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import Redis from "ioredis";
import { CacheKeys } from "../../cache/cache.service";
import {
  PopularCachePayload,
  PopularPeriod,
  PopularSourceType,
} from "../types/popular-post.types";

@Injectable()
export class PopularCacheService {
  private readonly logger = new Logger(PopularCacheService.name);
  private readonly baseTtlSeconds = 30 * 60 * 60; // 30h
  private readonly jitterSeconds = 10 * 60; // 10m

  constructor(@InjectRedis("cache") private readonly redis: Redis) {}

  private getCacheKey(
    source: PopularSourceType,
    period: PopularPeriod,
  ): string {
    return CacheKeys.POPULAR_V2(source, period);
  }

  private getNamespacedKey(key: string): string {
    return `cache:${key}`;
  }

  private getTtlWithJitter(): number {
    const randomOffset = Math.floor(Math.random() * (this.jitterSeconds + 1));
    return this.baseTtlSeconds + randomOffset;
  }

  async get(
    source: PopularSourceType,
    period: PopularPeriod,
  ): Promise<PopularCachePayload | null> {
    const key = this.getNamespacedKey(this.getCacheKey(source, period));

    try {
      const raw = await this.redis.get(key);
      if (!raw) {
        return null;
      }

      return JSON.parse(raw) as PopularCachePayload;
    } catch (error) {
      this.logger.error(
        `Failed to get popular cache for ${source}:${period}`,
        error instanceof Error ? error.stack : String(error),
      );
      return null;
    }
  }

  /**
   * 배치 결과를 임시 키에 쓴 뒤 rename으로 교체한다.
   * rename은 원자적이므로 읽기 요청이 빈 상태를 보는 구간이 없다.
   */
  async setAtomic(
    source: PopularSourceType,
    period: PopularPeriod,
    payload: PopularCachePayload,
  ): Promise<void> {
    const key = this.getNamespacedKey(this.getCacheKey(source, period));
    const tempKey = `${key}:tmp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const ttl = this.getTtlWithJitter();

    try {
      await this.redis.setex(tempKey, ttl, JSON.stringify(payload));
      await this.redis.rename(tempKey, key);
      await this.redis.expire(key, ttl);
    } catch (error) {
      this.logger.error(
        `Failed to set popular cache for ${source}:${period}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
