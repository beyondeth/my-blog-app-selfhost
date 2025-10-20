import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { McpProxyController } from './controllers/mcp-proxy.controller';
import { McpController } from './controllers/mcp.controller';
import { PostsModule } from '../posts/posts.module';
import { RedisModule } from '../redis/redis.module';
import { CacheModule } from '../cache/cache.module';
import { UsageModule } from '../usage/usage.module';
import { User } from '../users/entities/user.entity';
import { Blog } from '../blogs/entities/blog.entity';
import { McpApiKey } from './entities/mcp-api-key.entity';
import { UsageTracking } from '../usage/entities/usage-tracking.entity';
import { McpApiKeyService } from './services/mcp-api-key.service';

/**
 * MCP (Model Context Protocol) 모듈
 *
 * API Key 기반 인증:
 * - Stripe 스타일 API Key (blog_sk_{hint}_{secret})
 * - MCP Proxy Server → Backend 검증
 * - 사용자당 1개, 90일 만료, 200req/h 제한
 *
 * 구성:
 * - McpController: API Key 관리 엔드포인트 (create, list, delete, validate)
 * - McpProxyController: MCP 자동포스팅 엔드포인트
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Blog,
      McpApiKey,
      UsageTracking, // 관리자 통계용
    ]),
    PostsModule,
    RedisModule,
    CacheModule,
    UsageModule,  // 관리자 통계용
  ],
  controllers: [
    McpController,        // API Key 관리
    McpProxyController,   // MCP 자동포스팅
  ],
  providers: [McpApiKeyService],
  exports: [McpApiKeyService],
})
export class McpModule {}