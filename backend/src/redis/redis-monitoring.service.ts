import { Injectable, Logger } from "@nestjs/common";
import { InjectRedis } from "@nestjs-modules/ioredis";
import { Redis, RedisOptions } from "ioredis";
import { Queue } from "bullmq";

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface RedisMemoryInfo {
  usedMemory: string;
  usedMemoryHuman: string;
  usedMemoryPeak: string;
  usedMemoryPeakHuman: string;
  memoryFragmentation: number;
  connectedClients: number;
  totalKeys: number;
  uptime: number;
}

export interface KeyPattern {
  pattern: string;
  count: number;
  percentage: number;
}

export interface Lock {
  resource: string;
  ttl: number;
  locked: boolean;
}

export interface RateLimitStatus {
  blockedIPs: Array<{
    ip: string;
    apiKeyId: string;
    blockedUntil: Date;
    remainingTime: number;
  }>;
  apiKeyUsage: Array<{
    apiKeyId: string;
    minuteCount: number;
    hourCount: number;
    dayCount: number;
  }>;
}

@Injectable()
export class RedisMonitoringService {
  private readonly logger = new Logger(RedisMonitoringService.name);
  private suspiciousQueue: Queue;

  constructor(@InjectRedis() private readonly redis: Redis) {
    this.suspiciousQueue = new Queue("suspicious-requests", {
      connection: this.createBullConnection(),
    });
  }

  /**
   * BullMQ 통계 조회용 Redis 커넥션
   * commandTimeout을 제거해 queue API 호출이 타임아웃 되지 않도록 한다.
   */
  private createBullConnection(): Redis {
    const overrides: RedisOptions = {
      maxRetriesPerRequest: null,
      commandTimeout: undefined,
    };
    return this.redis.duplicate(overrides);
  }

  /**
   * Get BullMQ queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.suspiciousQueue.getWaitingCount(),
        this.suspiciousQueue.getActiveCount(),
        this.suspiciousQueue.getCompletedCount(),
        this.suspiciousQueue.getFailedCount(),
        this.suspiciousQueue.getDelayedCount(),
      ]);

      // BullMQ doesn't have getPausedCount, we'll check if queue is paused
      const isPaused = await this.suspiciousQueue.isPaused();

      return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused: isPaused ? 1 : 0,
      };
    } catch (error) {
      this.logger.error("Failed to get queue stats:", error);
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: 0,
      };
    }
  }

  /**
   * Get Redis memory and server information
   */
  async getRedisInfo(): Promise<RedisMemoryInfo> {
    try {
      const info = await this.redis.info();
      const keys = await this.redis.keys("*");

      // Parse Redis INFO output
      const infoLines = info.split("\r\n");
      const infoMap: Record<string, string> = {};

      infoLines.forEach((line) => {
        if (line && !line.startsWith("#") && line.includes(":")) {
          const [key, value] = line.split(":");
          infoMap[key] = value;
        }
      });

      return {
        usedMemory: infoMap["used_memory"] || "0",
        usedMemoryHuman: infoMap["used_memory_human"] || "0B",
        usedMemoryPeak: infoMap["used_memory_peak"] || "0",
        usedMemoryPeakHuman: infoMap["used_memory_peak_human"] || "0B",
        memoryFragmentation:
          parseFloat(infoMap["mem_fragmentation_ratio"]) || 1,
        connectedClients: parseInt(infoMap["connected_clients"]) || 0,
        totalKeys: keys.length,
        uptime: parseInt(infoMap["uptime_in_seconds"]) || 0,
      };
    } catch (error) {
      this.logger.error("Failed to get Redis info:", error);
      throw error;
    }
  }

  /**
   * Get key patterns distribution
   */
  async getKeyPatterns(): Promise<KeyPattern[]> {
    try {
      const keys = await this.redis.keys("*");
      const patterns: Record<string, number> = {
        "cache:": 0,
        "bull:": 0,
        "lock:": 0,
        "mcp:": 0,
        other: 0,
      };

      keys.forEach((key) => {
        if (key.startsWith("cache:")) patterns["cache:"]++;
        else if (key.startsWith("bull:")) patterns["bull:"]++;
        else if (key.startsWith("lock:")) patterns["lock:"]++;
        else if (key.startsWith("mcp:")) patterns["mcp:"]++;
        else patterns["other"]++;
      });

      const total = keys.length || 1;

      return Object.entries(patterns).map(([pattern, count]) => ({
        pattern,
        count,
        percentage: Math.round((count / total) * 100),
      }));
    } catch (error) {
      this.logger.error("Failed to get key patterns:", error);
      return [];
    }
  }

  /**
   * Get distributed locks status
   */
  async getLockStatus(): Promise<Lock[]> {
    try {
      const lockKeys = await this.redis.keys("lock:*");
      const locks: Lock[] = [];

      for (const key of lockKeys) {
        const ttl = await this.redis.ttl(key);
        locks.push({
          resource: key.replace("lock:", ""),
          ttl,
          locked: ttl > 0,
        });
      }

      return locks;
    } catch (error) {
      this.logger.error("Failed to get lock status:", error);
      return [];
    }
  }

  /**
   * Get rate limiting status
   */
  async getRateLimitStatus(): Promise<RateLimitStatus> {
    try {
      // Get blocked IPs
      const blockKeys = await this.redis.keys("mcp:block:*");
      const blockedIPs = [];

      for (const key of blockKeys) {
        const value = await this.redis.get(key);
        const parts = key.split(":");
        const ip = parts[2];
        const apiKeyId = parts[3];
        const blockedUntil = parseInt(value || "0");
        const now = Math.floor(Date.now() / 1000);

        if (blockedUntil > now) {
          blockedIPs.push({
            ip,
            apiKeyId,
            blockedUntil: new Date(blockedUntil * 1000),
            remainingTime: blockedUntil - now,
          });
        }
      }

      // Get API key usage
      const rateKeys = await this.redis.keys("mcp:rate:*");
      const apiKeyUsageMap: Record<string, any> = {};

      for (const key of rateKeys) {
        const value = await this.redis.get(key);
        const parts = key.split(":");
        const ip = parts[2];
        const apiKeyId = parts[3];
        const period = parts[4]; // minute, hour, or day

        const mapKey = `${ip}:${apiKeyId}`;
        if (!apiKeyUsageMap[mapKey]) {
          apiKeyUsageMap[mapKey] = {
            ip,
            apiKeyId,
            minuteCount: 0,
            hourCount: 0,
            dayCount: 0,
          };
        }

        const count = parseInt(value || "0");
        if (period === "minute") apiKeyUsageMap[mapKey].minuteCount = count;
        else if (period === "hour") apiKeyUsageMap[mapKey].hourCount = count;
        else if (period === "day") apiKeyUsageMap[mapKey].dayCount = count;
      }

      return {
        blockedIPs,
        apiKeyUsage: Object.values(apiKeyUsageMap),
      };
    } catch (error) {
      this.logger.error("Failed to get rate limit status:", error);
      return {
        blockedIPs: [],
        apiKeyUsage: [],
      };
    }
  }

  /**
   * Clear specific pattern of keys (dangerous operation)
   */
  async clearPattern(pattern: string): Promise<number> {
    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      return keys.length;
    } catch (error) {
      this.logger.error(`Failed to clear pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Unblock a specific IP
   */
  async unblockIP(ip: string, apiKeyId: string): Promise<boolean> {
    try {
      const key = `mcp:block:${ip}:${apiKeyId}`;
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to unblock IP ${ip}:`, error);
      return false;
    }
  }

  /**
   * Force release a lock (dangerous operation)
   */
  async releaseLock(resource: string): Promise<boolean> {
    try {
      const key = `lock:${resource}`;
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to release lock ${resource}:`, error);
      return false;
    }
  }

  /**
   * Check Redis connection status
   */
  async isConnected(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === "PONG";
    } catch (error) {
      this.logger.error("Redis connection check failed:", error);
      return false;
    }
  }

  /**
   * Get Redis connection details
   */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    latency: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      const result = await this.redis.ping();
      const latency = Date.now() - start;

      return {
        connected: result === "PONG",
        latency,
      };
    } catch (error) {
      this.logger.error("Failed to get connection status:", error);
      return {
        connected: false,
        latency: -1,
        error: error.message,
      };
    }
  }
}
