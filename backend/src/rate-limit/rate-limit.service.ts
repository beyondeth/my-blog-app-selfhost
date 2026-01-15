import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { ConfigService } from "@nestjs/config";
import type Redis from "ioredis";
import {
  RateLimitConfig,
  RateLimitDecision,
  RateLimitGroupPolicy,
} from "./interfaces/rate-limit.interfaces";

@Injectable()
export class RateLimitService {
  private readonly logger = new Logger(RateLimitService.name);

  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  private getConfig(): RateLimitConfig | undefined {
    return this.configService.get<RateLimitConfig>("rateLimit");
  }

  private getPolicy(group: string): RateLimitGroupPolicy {
    const config = this.getConfig();
    return (
      config?.groups?.[group] ??
      config?.groups?.default ?? {
        limit: 120,
        ttl: 60,
        blockDuration: config?.defaultBlockDuration ?? 60,
      }
    );
  }

  private getBlockDuration(policy: RateLimitGroupPolicy): number {
    const defaultBlock = this.getConfig()?.defaultBlockDuration ?? policy.ttl;
    return policy.blockDuration ?? defaultBlock ?? policy.ttl;
  }

  private buildKey(group: string, identifier: string) {
    return `rate-limit:${group}:${identifier}`;
  }

  private buildBlockKey(group: string, identifier: string) {
    return `rate-limit:block:${group}:${identifier}`;
  }

  private normalizeIdentifier(identifier?: string | null): string {
    if (!identifier) return "anonymous";
    return identifier.replace(/\s+/g, "");
  }

  async isBlocked(group: string, identifier: string): Promise<number | null> {
    const blockKey = this.buildBlockKey(group, identifier);
    const ttl = await this.redis.pttl(blockKey);
    if (ttl === -2 || ttl === -1) {
      return null;
    }
    return ttl;
  }

  async consume(group: string, identifier: string): Promise<RateLimitDecision> {
    const cleanIdentifier = this.normalizeIdentifier(identifier);
    const policy = this.getPolicy(group);
    const key = this.buildKey(group, cleanIdentifier);
    const blockKey = this.buildBlockKey(group, cleanIdentifier);

    const blockedTtl = await this.isBlocked(group, cleanIdentifier);
    if (blockedTtl && blockedTtl > 0) {
      return {
        allowed: false,
        limit: policy.limit,
        retryAfter: Math.ceil(blockedTtl / 1000),
        blocked: true,
      };
    }

    const current = await this.redis.incr(key);
    if (current === 1) {
      await this.redis.pexpire(key, policy.ttl * 1000);
    }

    if (current > policy.limit) {
      const blockDurationMs = this.getBlockDuration(policy) * 1000;
      await this.redis.set(blockKey, "1", "PX", blockDurationMs, "NX");
      const retryAfter = await this.redis.pttl(key);

      this.logger.warn(
        `Rate limit exceeded: group=${group}, identifier=${cleanIdentifier}, limit=${policy.limit}/${policy.ttl}s`,
      );

      return {
        allowed: false,
        limit: policy.limit,
        retryAfter: retryAfter > 0 ? Math.ceil(retryAfter / 1000) : undefined,
      };
    }

    const ttl = await this.redis.pttl(key);

    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(policy.limit - current, 0),
      resetAfter: ttl > 0 ? Math.ceil(ttl / 1000) : undefined,
    };
  }
}
