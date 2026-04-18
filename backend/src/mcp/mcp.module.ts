import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { McpProxyController } from "./controllers/mcp-proxy.controller";
import { McpController } from "./controllers/mcp.controller";
import { PostsModule } from "../posts/posts.module";
import { RedisModule } from "../redis/redis.module";
import { CacheModule } from "../cache/cache.module";
import { UsageModule } from "../usage/usage.module";
import { FilesModule } from "../files/files.module";
import { UsersModule } from "../users/users.module";
import { BlogsModule } from "../blogs/blogs.module";
import { User } from "../users/entities/user.entity";
import { Blog } from "../blogs/entities/blog.entity";
import { McpApiKey } from "./entities/mcp-api-key.entity";
import { UsageTracking } from "../usage/entities/usage-tracking.entity";
import { McpApiKeyService } from "./services/mcp-api-key.service";
import { McpApiKeySecretService } from "./services/mcp-api-key-secret.service";
import { KnowledgeModule } from "../knowledge/knowledge.module";

/**
 * MCP (Model Context Protocol) 모듈
 *
 * 인증 방식:
 * 1. API Key 모드: Stripe 스타일 API Key (blog_sk_{hint}_{secret})
 * 2. OAuth 모드: Claude 커스텀 커넥터 (X-OAuth-* 헤더)
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
    FilesModule,
    RedisModule,
    CacheModule,
    UsageModule, // 관리자 통계용
    UsersModule, // OAuth 인증용
    BlogsModule, // OAuth 인증용
    KnowledgeModule,
  ],
  controllers: [
    McpController, // API Key 관리
    McpProxyController, // MCP 자동포스팅
  ],
  providers: [McpApiKeyService, McpApiKeySecretService],
  exports: [McpApiKeyService],
})
export class McpModule {}
