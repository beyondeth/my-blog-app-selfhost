import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { UsersModule } from "../users/users.module";
import { BlogsModule } from "../blogs/blogs.module";
import { EmailModule } from "../email/email.module";
import { RedisModule } from "../redis/redis.module";
import { PasswordResetToken } from "./entities/password-reset-token.entity";
import { RefreshSession } from "./entities/refresh-session.entity";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { KakaoStrategy } from "./strategies/kakao.strategy";
import { GitHubStrategy } from "./strategies/github.strategy";
import { AuditModule } from "../audit/audit.module";

const providers: any[] = [
  AuthService,
  JwtStrategy,
  GoogleStrategy,
  KakaoStrategy,
  GitHubStrategy,
];

@Module({
  imports: [
    UsersModule,
    BlogsModule,
    EmailModule,
    RedisModule,
    PassportModule,
    TypeOrmModule.forFeature([PasswordResetToken, RefreshSession]),
    AuditModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get("JWT_SECRET"),
        signOptions: { expiresIn: "7d" },
      }),
      inject: [ConfigService],
    }),
  ],
  providers,
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
