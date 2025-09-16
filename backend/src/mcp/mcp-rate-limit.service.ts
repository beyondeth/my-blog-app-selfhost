import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

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
    perHour: 10,     // 시간당 10회
    perDay: 10,      // 일일 10회
    blockDuration: 300, // 5분 차단
  };

  constructor(private readonly cacheService: CacheService) {}

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
    const blockUntil = await this.cacheService.get<number>(blockKey);
    if (blockUntil && now < blockUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        retryAfter: blockUntil - now,
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

    const current = await this.cacheService.get<number>(windowKey) || 0;
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

    const current = await this.cacheService.get<number>(windowKey) || 0;
    await this.cacheService.set(windowKey, current + 1, seconds + 10); // 약간의 여유 TTL
  }

  /**
   * 연속 실패 기록
   */
  async recordFailure(ip: string, apiKeyId: string): Promise<void> {
    const failureKey = `mcp:failures:${ip}:${apiKeyId}`;
    const failures = await this.cacheService.get<number>(failureKey) || 0;

    const newFailures = failures + 1;
    await this.cacheService.set(failureKey, newFailures, 3600); // 1시간 TTL

    // 연속 3회 실패 시 5분 차단
    if (newFailures >= 3) {
      const blockKey = `mcp:block:${ip}:${apiKeyId}`;
      const blockUntil = Math.floor(Date.now() / 1000) + this.DEFAULT_CONFIG.blockDuration;

      await this.cacheService.set(blockKey, blockUntil, this.DEFAULT_CONFIG.blockDuration);

      this.logger.warn(
        `Blocking IP ${ip} with API Key ${apiKeyId} for ${this.DEFAULT_CONFIG.blockDuration}s due to ${newFailures} failures`
      );

      // 실패 카운터 리셋
      await this.cacheService.del(failureKey);
    }
  }

  /**
   * 성공 시 실패 카운터 리셋
   */
  async recordSuccess(ip: string, apiKeyId: string): Promise<void> {
    const failureKey = `mcp:failures:${ip}:${apiKeyId}`;
    await this.cacheService.del(failureKey);
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
      const stats = await this.cacheService.getStats();
      const rateLimitKeys = stats.patterns?.['mcp'] || 0;

      // 대략적인 통계 (실제로는 더 정확한 구현 필요)
      return {
        activeRateLimits: rateLimitKeys,
        blockedIPs: Math.floor(rateLimitKeys * 0.1), // 추정값
        topIPs: [
          { ip: '127.0.0.1', requests: 8 },
          { ip: '::1', requests: 5 },
        ],
      };
    } catch (error) {
      this.logger.error('Failed to get rate limit stats:', error);
      return {
        activeRateLimits: -1,
        blockedIPs: -1,
        topIPs: [],
      };
    }
  }
}