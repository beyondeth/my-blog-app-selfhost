import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Redis } from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitConfig {
  perMinute: number;
  perHour: number;
  perDay: number;
  blockDuration: number; // 연속 실패 시 차단 시간 (초)
}

@Injectable()
export class McpRateLimitService {
  private readonly logger = new Logger(McpRateLimitService.name);

  // MCP 자동포스팅 특화 제한값
  private readonly DEFAULT_CONFIG: RateLimitConfig = {
    perMinute: 3,    // 분당 3회
    perHour: 15,     // 시간당 10회
    perDay: 15,      // 일일 10회
    blockDuration: 300, // 5분 차단
  };

  constructor(@InjectRedis() private readonly redis: Redis) {}

  /**
   * Rate Limit 체크 (IP + API Key 조합)
   */
  async checkRateLimit(
    ip: string,
    apiKeyId: string,
    config: RateLimitConfig = this.DEFAULT_CONFIG
  ): Promise<RateLimitResult> {
    const now = Math.floor(Date.now() / 1000);

    // 1. 연속 실패로 인한 차단 확인
    const blockKey = `mcp:block:${ip}:${apiKeyId}`;
    const blockUntil = await this.redis.get(blockKey);
    if (blockUntil && now < parseInt(blockUntil)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: parseInt(blockUntil),
        retryAfter: parseInt(blockUntil) - now,
      };
    }

    // 2. 분당 제한 체크
    const minuteCheck = await this.checkTimeWindow(
      ip, apiKeyId, 'minute', config.perMinute, 60, now
    );
    if (!minuteCheck.allowed) return minuteCheck;

    // 3. 시간당 제한 체크
    const hourCheck = await this.checkTimeWindow(
      ip, apiKeyId, 'hour', config.perHour, 3600, now
    );
    if (!hourCheck.allowed) return hourCheck;

    // 4. 일일 제한 체크
    const dayCheck = await this.checkTimeWindow(
      ip, apiKeyId, 'day', config.perDay, 86400, now
    );
    if (!dayCheck.allowed) return dayCheck;

    // 5. 모든 제한 통과 - 카운터 증가
    await Promise.all([
      this.incrementCounter(ip, apiKeyId, 'minute', 60, now),
      this.incrementCounter(ip, apiKeyId, 'hour', 3600, now),
      this.incrementCounter(ip, apiKeyId, 'day', 86400, now),
    ]);

    this.logger.debug(`Rate limit passed - IP: ${ip}, API Key: ${apiKeyId}`);

    return {
      allowed: true,
      remaining: Math.min(
        config.perMinute - minuteCheck.remaining - 1,
        config.perHour - hourCheck.remaining - 1,
        config.perDay - dayCheck.remaining - 1
      ),
      resetTime: now + 60, // 다음 분까지
    };
  }

  /**
   * 특정 시간 윈도우에서 제한 체크
   */
  private async checkTimeWindow(
    ip: string,
    apiKeyId: string,
    window: string,
    limit: number,
    seconds: number,
    now: number
  ): Promise<RateLimitResult> {
    const key = `mcp:rate:${ip}:${apiKeyId}:${window}`;
    const windowStart = Math.floor(now / seconds) * seconds;
    const windowKey = `${key}:${windowStart}`;

    const current = parseInt(await this.redis.get(windowKey) || '0');
    const remaining = limit - current;
    const resetTime = windowStart + seconds;

    if (current >= limit) {
      this.logger.warn(
        `Rate limit exceeded - IP: ${ip}, API Key: ${apiKeyId}, Window: ${window}, Current: ${current}/${limit}`
      );

      return {
        allowed: false,
        remaining: 0,
        resetTime,
        retryAfter: resetTime - now,
      };
    }

    return {
      allowed: true,
      remaining,
      resetTime,
    };
  }

  /**
   * 카운터 증가
   */
  private async incrementCounter(
    ip: string,
    apiKeyId: string,
    window: string,
    seconds: number,
    now: number
  ): Promise<void> {
    const key = `mcp:rate:${ip}:${apiKeyId}:${window}`;
    const windowStart = Math.floor(now / seconds) * seconds;
    const windowKey = `${key}:${windowStart}`;

    const current = parseInt(await this.redis.get(windowKey) || '0');
    await this.redis.setex(windowKey, seconds + 10, String(current + 1)); // 약간의 여유 TTL
  }

  /**
   * 연속 실패 기록
   */
  async recordFailure(ip: string, apiKeyId: string): Promise<void> {
    const failureKey = `mcp:failures:${ip}:${apiKeyId}`;
    const failures = parseInt(await this.redis.get(failureKey) || '0');

    const newFailures = failures + 1;
    await this.redis.setex(failureKey, 3600, String(newFailures)); // 1시간 TTL

    // 연속 3회 실패 시 5분 차단
    if (newFailures >= 3) {
      const blockKey = `mcp:block:${ip}:${apiKeyId}`;
      const blockUntil = Math.floor(Date.now() / 1000) + this.DEFAULT_CONFIG.blockDuration;

      await this.redis.setex(blockKey, this.DEFAULT_CONFIG.blockDuration, String(blockUntil));

      this.logger.warn(
        `Blocking IP ${ip} with API Key ${apiKeyId} for ${this.DEFAULT_CONFIG.blockDuration}s due to ${newFailures} failures`
      );

      // 실패 카운터 리셋
      await this.redis.del(failureKey);
    }
  }

  /**
   * 성공 시 실패 카운터 리셋
   */
  async recordSuccess(ip: string, apiKeyId: string): Promise<void> {
    const failureKey = `mcp:failures:${ip}:${apiKeyId}`;
    await this.redis.del(failureKey);
  }

  /**
   * Rate Limiting 통계 조회 (관리자용)
   */
  async getRateLimitStats(): Promise<{
    activeRateLimits: number;
    blockedIPs: number;
    topIPs: Array<{ ip: string; requests: number }>;
  }> {
    try {
      // Redis에서 직접 rate limit 관련 키 조회
      const [rateLimitKeys, blockKeys] = await Promise.all([
        this.redis.keys('mcp:rate:*'),
        this.redis.keys('mcp:block:*'),
      ]);

      // 상위 IP 통계 (간단한 구현)
      const ipCounts: Record<string, number> = {};
      for (const key of rateLimitKeys) {
        const parts = key.split(':');
        if (parts[2]) { // IP 부분 추출
          const ip = parts[2];
          const value = await this.redis.get(key);
          ipCounts[ip] = (ipCounts[ip] || 0) + parseInt(value || '0');
        }
      }

      const topIPs = Object.entries(ipCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([ip, requests]) => ({ ip, requests }));

      return {
        activeRateLimits: rateLimitKeys.length,
        blockedIPs: blockKeys.length,
        topIPs: topIPs.length > 0 ? topIPs : [
          { ip: '127.0.0.1', requests: 0 },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit stats:', error);
      return {
        activeRateLimits: 0,
        blockedIPs: 0,
        topIPs: [],
      };
    }
  }
}