import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpRateLimitGuard } from './mcp-rate-limit.guard';
import { McpLoggingInterceptor } from './mcp-logging.interceptor';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { PostsModule } from '../posts/posts.module';
import { AuthModule } from '../auth/auth.module';
import { SharedTrackingModule } from '../shared/shared-tracking.module';

@Module({
  imports: [
    ApiKeysModule,
    PostsModule,  // PostsService를 사용하기 위해 필요
    AuthModule,
    SharedTrackingModule,  // McpTrackingService를 위해 필요
  ],
  controllers: [McpController],
  providers: [
    McpService,
    McpAuthGuard,
    McpRateLimitGuard,
    McpLoggingInterceptor,
  ],
})
export class McpModule {}