import { Module, Global } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import { CacheService } from './cache.service';
import { CacheInterceptor } from './cache.interceptor';
import { CacheController } from './cache.controller';
import { createCustomMemoryStore } from './custom-cache.store';

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<any> => {
        const isProduction = configService.get('NODE_ENV') === 'production';
        const redisHost = configService.get('REDIS_HOST', 'localhost');
        const redisPort = configService.get('REDIS_PORT', 6379);
        
        if (isProduction || redisHost !== 'localhost') {
          // Production 또는 Redis 설정이 있는 경우: Redis 시도
          try {
            const redis = require('redis');
            const client = redis.createClient({
              host: redisHost,
              port: redisPort,
              password: configService.get('REDIS_PASSWORD'),
            });
            
            // Redis 연결 테스트 (timeout 2초)
            await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                client.quit();
                reject(new Error('Redis connection timeout'));
              }, 2000);
              
              client.on('ready', () => {
                clearTimeout(timeout);
                client.quit();
                resolve(true);
              });
              
              client.on('error', (err) => {
                clearTimeout(timeout);
                client.quit();
                reject(err);
              });
            });
            
            console.log('✅ Redis connection successful, using Redis cache');
            return {
              store: redisStore,
              host: redisHost,
              port: redisPort,
              password: configService.get('REDIS_PASSWORD'),
              ttl: 300, // 기본 TTL 5분
              max: 100, // 최대 캐시 항목 수
              // Redis 에러 시 fallback을 위한 설정
              onClientError: (error) => {
                console.error('Redis client error:', error);
              },
            };
          } catch (error) {
            console.warn('⚠️ Redis connection failed, falling back to memory cache:', error.message);
            // Redis 연결 실패 시 메모리 캐시로 fallback
            return {
              ttl: 60, // 메모리 캐시는 짧은 TTL
              max: 50,
            };
          }
        } else {
          // Development: 커스텀 메모리 캐시 사용 (확장된 설정)
          console.log('📦 Using custom memory cache for development (Enhanced: 5000 items)');
          return {
            store: createCustomMemoryStore({
              ttl: 600, // 개발 환경에서도 충분한 TTL (10분)로 캐시 히트 가능하게
              max: 5000, // 50 -> 5000개로 확장
            }) as any,
          };
        }
      },
    }),
  ],
  controllers: [CacheController],
  providers: [CacheService, CacheInterceptor],
  exports: [NestCacheModule, CacheService],
})
export class CacheModule {}