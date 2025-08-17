import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthApiKeyService } from './auth-api-key.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { BlogsModule } from '../blogs/blogs.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { EmailModule } from '../email/email.module';
import { ApiKey } from '../api-keys/entities/api-key.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { KakaoStrategy } from './strategies/kakao.strategy';

@Module({
  imports: [
    UsersModule,
    BlogsModule,
    ApiKeysModule,
    EmailModule,
    PassportModule,
    TypeOrmModule.forFeature([ApiKey]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '7d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, AuthApiKeyService, JwtStrategy, GoogleStrategy, KakaoStrategy],
  controllers: [AuthController],
  exports: [AuthService, AuthApiKeyService],
})
export class AuthModule {} 