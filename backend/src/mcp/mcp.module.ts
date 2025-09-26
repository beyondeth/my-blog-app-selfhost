import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpProxyController } from './controllers/mcp-proxy.controller';
import { OauthModule } from '../oauth/oauth.module';
import { PostsModule } from '../posts/posts.module';
import { RedisModule } from '../redis/redis.module';
import { User } from '../users/entities/user.entity';

/**
 * MCP (Model Context Protocol) 모듈
 * OAuth2 기반 인증으로 완전히 전환
 * MCP 서버가 OAuth2 인증을 통해 블로그에 포스트를 생성할 수 있도록 하는 프록시 모듈
 *
 * 기존 HMAC 인증 관련 컴포넌트들은 제거됨:
 * - McpController (레거시)
 * - McpService (레거시)
 * - McpAuthGuard (HMAC 기반)
 * - ApiKeysModule (HMAC 기반)
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),  // User 엔티티 접근을 위해 필요
    OauthModule,  // OAuth2 인증을 위해 필요
    PostsModule,  // PostsService를 사용하기 위해 필요
    RedisModule,  // Redis 직접 접근을 위해 필요
  ],
  controllers: [McpProxyController],
  providers: [],
  exports: [],
})
export class McpModule {}