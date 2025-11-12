import { Module, Global } from '@nestjs/common';
import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';
import { RedisLockService } from './redis-lock.service';
import { RedisMonitoringService } from './redis-monitoring.service';
import { RedisController } from './redis.controller';
import { UnifiedRedisService } from './unified-redis.service';

@Global()
@Module({
  imports: [
    NestRedisModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get('REDIS_URL') || 'redis://localhost:6379',
        options: {
          maxRetriesPerRequest: null, // BullMQ requires this to be null
          enableReadyCheck: true,
          showFriendlyErrorStack: process.env.NODE_ENV === 'development',
          retryStrategy: (times: number) => {
            // 재연결 전략
            if (times > 3) {
              return null; // 3회 이상 실패 시 중단
            }
            return Math.min(times * 50, 2000); // 지수 백오프
          },
          // 메모리 최적화 설정
          maxmemory: configService.get('REDIS_MAX_MEMORY') || '2gb',
          maxmemoryPolicy: configService.get('REDIS_MAX_MEMORY_POLICY') || 'allkeys-lru',
          // 커넥션 풀링
          connectTimeout: 10000,
          commandTimeout: 15000, // 5초에서 15초로 증가
          lazyConnect: true,
          keepAlive: 30000,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [RedisController],
  providers: [RedisLockService, RedisMonitoringService, UnifiedRedisService],
  exports: [NestRedisModule, RedisLockService, RedisMonitoringService, UnifiedRedisService],
})
export class RedisModule {}