import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';

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
import { TagsModule } from './tags/tags.module';
import { McpModule } from './mcp/mcp.module';
import { EmailModule } from './email/email.module';
import { ReportsModule } from './reports/reports.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { CacheModule } from './cache/cache.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { RedisModule } from './redis/redis.module';
import { ChatModule } from './chat/chat.module';
import { MetricsModule } from './metrics/metrics.module';
// import { AnalyticsModule } from './analytics/analytics.module';
// FUTURE: 구독제 기능 활성화 시 주석 해제
// import { SubscriptionModule } from './subscription/subscription.module';
// import { PaymentModule } from './payment/payment.module';
// import { UsageModule } from './usage/usage.module';
// import { PaymentEventsModule } from './payment/payment-events.module';
// import { SharedSubscriptionModule } from './shared/shared-subscription.module';

// Guards
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { FollowsModule } from './follows/follows.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OauthModule } from './oauth/oauth.module';
import { BookmarksModule } from './bookmarks/bookmarks.module';

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
    // 다중 시간대 Rate Limit: 분당 3회, 시간당 10회, 하루 20회
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'minute',
          ttl: 60000,      // 1분 (60초)
          limit: 3,        // 분당 3회
        },
        {
          name: 'hour',
          ttl: 3600000,    // 1시간 (3600초)
          limit: 10,       // 시간당 10회
        },
        {
          name: 'day',
          ttl: 86400000,   // 1일 (86400초)
          limit: 20,       // 하루 20회
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

    // Schedule configuration for Cron jobs
    ScheduleModule.forRoot(),

    // Feature modules
    RedisModule, // Global Redis module for distributed state management
    CacheModule, // Global cache module with Redis support
    MonitoringModule, // Global monitoring module for suspicious requests
    MetricsModule, // Prometheus metrics module
    // FUTURE: 구독제 기능 활성화 시 주석 해제
    // PaymentEventsModule, // Global payment events module (Event-Driven Architecture)
    AuthModule,
    UsersModule, // 먼저 로드 - 다른 모듈들이 의존
    PostsModule,
    TagsModule,
    CommentsModule,
    FilesModule,
    BlogsModule,
    BookmarksModule,
    McpModule,
    EmailModule,
    ReportsModule,
    AuditModule,
    AdminModule,
    FollowsModule,
    NotificationsModule,
    ChatModule,
    OauthModule,
    // AnalyticsModule,
    // FUTURE: 구독제 기능 활성화 시 주석 해제
    // SubscriptionModule, // UsersModule 이후에 로드
    // UsageModule, // SubscriptionModule과 UsersModule 이후에 로드
    // SharedSubscriptionModule, // UsageModule 이후에 로드 (UsageLimitGuard 제공)
    // PaymentModule, // 마지막에 로드 (이벤트 기반으로 다른 모듈과 통신)
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