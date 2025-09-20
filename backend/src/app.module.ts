import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';

// Configuration imports
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import s3Config from './config/s3.config';

// Module imports
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PostsModule } from './posts/posts.module';
import { CommentsModule } from './comments/comments.module';
import { FilesModule } from './files/files.module';
import { BlogsModule } from './blogs/blogs.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { TagsModule } from './tags/tags.module';
import { McpModule } from './mcp/mcp.module';
import { EmailModule } from './email/email.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { CacheModule } from './cache/cache.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { SharedTrackingModule } from './shared/shared-tracking.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { MetricsModule } from './metrics/metrics.module';
// import { AnalyticsModule } from './analytics/analytics.module';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FollowsModule } from './follows/follows.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, s3Config],
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),

    // Database configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...configService.get('database'),
        synchronize: false,
        logging: false,
      }),
      inject: [ConfigService],
    }),

    // JWT configuration
    JwtModule.registerAsync({
      global: true,
      useFactory: jwtConfig,
    }),

    // Rate limiting configuration
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 3600000, // 1 hour in milliseconds
          limit: 15,    // 15 posts per hour per user
        }
      ]
    }),

    // BullMQ configuration for Redis connection
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),

    // Feature modules
    RedisModule, // Global Redis module for distributed state management
    CacheModule, // Global cache module with Redis support
    MonitoringModule, // Global monitoring module for suspicious requests
    SharedTrackingModule, // Shared module for MCP tracking functionality
    MetricsModule, // Prometheus metrics module
    AuthModule,
    UsersModule,
    PostsModule,
    TagsModule,
    CommentsModule,
    FilesModule,
    BlogsModule,
    ApiKeysModule,
    McpModule,
    EmailModule,
    ReportsModule,
    AuditModule,
    AdminModule,
    FollowsModule,
    NotificationsModule,
    ChatModule,
    // AnalyticsModule,
  ],
  providers: [
    // Global guards
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Add middleware configuration here if needed
  }
} 