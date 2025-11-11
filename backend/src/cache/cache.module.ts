import { Module, Global, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheController } from './cache.controller';
import { CacheWarmingService } from './cache-warming.service';
import { CacheInvalidationListener } from './cache-invalidation.listener';
import { RedisModule } from '../redis/redis.module';
import { MetricsModule } from '../metrics/metrics.module';
import { BlogsModule } from '../blogs/blogs.module';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';

@Global()
@Module({
  imports: [
    RedisModule, // UnifiedRedisService를 사용하기 위해 RedisModule import
    MetricsModule, // CacheMetricsService를 사용하기 위해 MetricsModule import
    TypeOrmModule.forFeature([Post, User]), // Post, User 엔티티 등록 (CacheWarmingService에서 사용)
    forwardRef(() => BlogsModule), // BlogsService를 사용하기 위해 BlogsModule import (순환 의존성 방지)
  ],
  controllers: [CacheController],
  providers: [
    CacheService,
    CacheInterceptor,
    CacheWarmingService,
    CacheInvalidationListener, // 이벤트 기반 캐시 무효화 리스너
  ],
  exports: [CacheService], // CacheService만 export
})
export class CacheModule {}