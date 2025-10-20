import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheController } from './cache.controller';
import { CacheWarmingService } from './cache-warming.service';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../metrics/metrics.module';
import { Post } from '../posts/entities/post.entity';

@Global()
@Module({
  imports: [
    RedisModule, // UnifiedRedisService를 사용하기 위해 RedisModule import
    MetricsModule, // CacheMetricsService를 사용하기 위해 MetricsModule import
    TypeOrmModule.forFeature([Post]), // Post 엔티티 직접 import
  ],
  controllers: [CacheController],
  providers: [CacheService, CacheInterceptor, CacheWarmingService],
  exports: [CacheService], // CacheService만 export
})
export class CacheModule {}