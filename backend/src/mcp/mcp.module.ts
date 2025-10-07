import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpProxyController } from './controllers/mcp-proxy.controller';
import { OauthModule } from '../oauth/oauth.module';
import { PostsModule } from '../posts/posts.module';
import { RedisModule } from '../redis/redis.module';
import { CacheModule } from '../cache/cache.module';
// FUTURE: 구독제 기능 활성화 시 주석 해제
// import { UsageModule } from '../usage/usage.module';
import { User } from '../users/entities/user.entity';

/**
 * MCP (Model Context Protocol) 모듈
 * OAuth2 기반 인증으로 완전히 전환
 * MCP 서버가 OAuth2 인증을 통해 블로그에 포스트를 생성할 수 있도록 하는 프록시 모듈
 *
 * Rate Limit: NestJS ThrottlerGuard 사용 (분당 3회, 시간당 10회, 하루 20회)
 *
 * 기존 HMAC 인증 관련 컴포넌트들은 제거됨:
 * - McpController (레거시 - 삭제됨)
 * - McpService (레거시 - 삭제됨)
 * - McpAuthGuard (HMAC 기반 - 삭제됨)
 * - ApiKeysModule (HMAC 기반 - 삭제됨)
 * - McpRateLimitGuard (HMAC 기반 - 삭제됨)
 * - McpRateLimitService (HMAC 기반 - 삭제됨)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),  // User 엔티티 접근을 위해 필요
    OauthModule,  // OAuth2 인증을 위해 필요
    PostsModule,  // PostsService를 사용하기 위해 필요
    RedisModule,  // Redis 직접 접근을 위해 필요
    CacheModule,  // CacheService를 통한 Redis 캐시 무효화를 위해 필요
    // FUTURE: 구독제 기능 활성화 시 주석 해제
    // UsageModule,  // UsageService를 통한 MCP 포스트 사용량 추적을 위해 필요
  ],
  controllers: [McpProxyController],
  providers: [],
  exports: [],
})
export class McpModule {}