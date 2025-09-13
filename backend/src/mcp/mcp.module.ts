import { Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { McpService } from './mcp.service';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpRateLimitGuard } from './mcp-rate-limit.guard';
import { McpLoggingInterceptor } from './mcp-logging.interceptor';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { PostsModule } from '../posts/posts.module';
import { BlogsModule } from '../blogs/blogs.module';
import { AuthModule } from '../auth/auth.module';
import { TagsModule } from '../tags/tags.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { SharedTrackingModule } from '../shared/shared-tracking.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Post } from '../posts/entities/post.entity';
import { User } from '../users/entities/user.entity';
import { MarkdownRendererService } from '../common/services/markdown-renderer.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Post, User]),
    ApiKeysModule,
    PostsModule,
    BlogsModule,
    AuthModule,
    TagsModule,
    MonitoringModule,
    SharedTrackingModule,  // Import the shared module instead
  ],
  controllers: [McpController],
  providers: [
    McpService,
    McpAuthGuard,
    McpRateLimitGuard,
    McpLoggingInterceptor,
    MarkdownRendererService,  // Add this for markdown conversion
  ],
  // No longer need to export McpTrackingService as it's now in SharedTrackingModule
})
export class McpModule {}