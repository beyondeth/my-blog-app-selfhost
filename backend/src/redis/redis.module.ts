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