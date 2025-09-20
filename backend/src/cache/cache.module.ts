import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheController } from './cache.controller';
import { RedisModule } from '../redis/redis.module';

@Global()
@Module({
  imports: [
    RedisModule, // UnifiedRedisService를 사용하기 위해 RedisModule import
  ],
  controllers: [CacheController],
  providers: [CacheService, CacheInterceptor],
  exports: [CacheService], // CacheService만 export
})
export class CacheModule {}