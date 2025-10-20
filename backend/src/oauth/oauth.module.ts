import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OAuthClient } from './entities/oauth-client.entity';
import { OAuthCode } from './entities/oauth-code.entity';
import { OAuthToken } from './entities/oauth-token.entity';
import { OAuthService } from './services/oauth.service';
import { OAuthController } from './controllers/oauth.controller';
import { DiscoveryController } from './controllers/discovery.controller';
import { OAuthGuard, OptionalOAuthGuard } from './guards/oauth.guard';
import { RedisModule } from '../redis/redis.module';
import { BlogsModule } from '../blogs/blogs.module';
import { UsersModule } from '../users/users.module';
import { User } from '../users/entities/user.entity';
import { Blog } from '../blogs/entities/blog.entity';

/**
 * OAuth2 모듈
 * OAuth2 Authorization Code Flow를 구현하여 MCP 클라이언트 인증 제공
 */
@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
    TypeOrmModule.forFeature([
      OAuthClient,
      OAuthCode,
      OAuthToken,
      User,
      Blog,
    ]),
    RedisModule,
    BlogsModule,  // BlogsService를 사용하기 위해 필요
    UsersModule,  // UsersService를 사용하기 위해 필요
  ],
  controllers: [OAuthController, DiscoveryController],
  providers: [OAuthService, OAuthGuard, OptionalOAuthGuard],
  exports: [OAuthService, OAuthGuard, OptionalOAuthGuard],
})
export class OauthModule {}
