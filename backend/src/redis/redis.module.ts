import { Module, Global } from "@nestjs/common";
import { RedisModule as NestRedisModule } from "@nestjs-modules/ioredis";
import { ConfigService } from "@nestjs/config";
import { RedisLockService } from "./redis-lock.service";
import { RedisMonitoringService } from "./redis-monitoring.service";
import { RedisController } from "./redis.controller";
import { UnifiedRedisService } from "./unified-redis.service";

@Global()
@Module({
  imports: [
    // Default connection = core Redis (queues, sessions, locks).
    NestRedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: "single",
        url:
          configService.get("REDIS_CORE_URL") ||
          configService.get("REDIS_URL") ||
          "redis://localhost:6379",
        options: {
          maxRetriesPerRequest: null, // BullMQ requires this to be null
          enableReadyCheck: true,
          showFriendlyErrorStack: process.env.NODE_ENV === "development",
          retryStrategy: (times: number) => {
            // Reconnect with capped backoff.
            if (times > 3) {
              return null;
            }
            return Math.min(times * 50, 2000);
          },
          // Client-side options only; server maxmemory is configured via redis-server.
          maxmemory: configService.get("REDIS_MAX_MEMORY") || "2gb",
          maxmemoryPolicy:
            configService.get("REDIS_MAX_MEMORY_POLICY") || "allkeys-lru",
          connectTimeout: 30000,
          commandTimeout: 30000,
          lazyConnect: true,
          keepAlive: 30000,
        },
      }),
      inject: [ConfigService],
    }),
    // Cache connection (evictable data only).
    NestRedisModule.forRootAsync(
      {
        useFactory: (configService: ConfigService) => ({
          type: "single",
          url:
            configService.get("REDIS_CACHE_URL") ||
            configService.get("REDIS_URL") ||
            "redis://localhost:6379",
          options: {
            maxRetriesPerRequest: null,
            enableReadyCheck: true,
            showFriendlyErrorStack: process.env.NODE_ENV === "development",
            retryStrategy: (times: number) => {
              if (times > 3) {
                return null;
              }
              return Math.min(times * 50, 2000);
            },
            maxmemory: configService.get("REDIS_CACHE_MAX_MEMORY") || "2gb",
            maxmemoryPolicy:
              configService.get("REDIS_CACHE_MAX_MEMORY_POLICY") ||
              "allkeys-lru",
            connectTimeout: 30000,
            commandTimeout: 30000,
            lazyConnect: true,
            keepAlive: 30000,
          },
        }),
        inject: [ConfigService],
      },
      "cache",
    ),
  ],
  controllers: [RedisController],
  providers: [RedisLockService, RedisMonitoringService, UnifiedRedisService],
  exports: [
    NestRedisModule,
    RedisLockService,
    RedisMonitoringService,
    UnifiedRedisService,
  ],
})
export class RedisModule {}
