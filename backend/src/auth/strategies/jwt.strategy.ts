import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { User } from '../../users/entities/user.entity';
import { Request } from 'express';
import { UnifiedRedisService } from '../../redis/unified-redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    private readonly unifiedRedisService: UnifiedRedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 쿠키에서 토큰 추출
        (request: Request) => {
          const token = request?.cookies?.access_token;
          return token;
        },
        // 백업으로 Authorization 헤더도 지원 (API 테스트용)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // JWT payload has 'sub' field (standard claim)
    const userId = payload.sub || payload.id;
    const tokenType = payload.tokenType;

    // 개발 환경에서 상세한 디버그 로그 추가
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[JWT] Starting validation for token type: ${tokenType}`);
      this.logger.debug(`[JWT] User ID (masked): ${userId ? userId.substring(0, 8) + '...' : 'null'}`);
    }

    if (!userId) {
      this.logger.error('[JWT] No userId found in JWT payload');
      return null;
    }

    if (tokenType !== 'access') {
      this.logger.error(`[JWT] Invalid token type: ${tokenType}`);
      return null;
    }

    const cacheKey = `user_validate_${userId}`;

    // 1. 캐시에서 사용자 정보 조회
    const cachedUser: User = await this.unifiedRedisService.getCache('sessions', cacheKey);
    if (cachedUser) {
      if (process.env.NODE_ENV === 'development') {
        this.logger.debug(`[JWT] Cache hit for user: ${cachedUser.email}, role: ${cachedUser.role}`);
      }
      return cachedUser;
    }

    // 2. 캐시에 없으면 DB에서 조회
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[JWT] Cache miss for user ID: ${userId.substring(0, 8)}...`);
    }
    const user = await this.usersService.findById(userId);

    if (!user) {
      this.logger.warn('[JWT] User not found in database');
      return null;
    }

    if (!user.isActive) {
      this.logger.warn('[JWT] User account is not active');
      return null;
    }

    // 삭제된 사용자 로그인 차단 (소프트 삭제)
    if (user.isDeleted) {
      this.logger.warn('[JWT] User account has been deleted');
      return null;
    }

    // 3. DB 조회 결과를 캐시에 저장
    // TTL 개선: 5초에서 30분으로 연장 (토큰 만료 시 자동 갱신)
    const cacheTTL = this.configService.get<number>('JWT_CACHE_TTL', 1800); // 30분
    await this.unifiedRedisService.setCache(
      'sessions',
      cacheKey,
      user,
      cacheTTL
    );

    // 디버그를 위해 관리자 로그 추가 (프로덕션에서는 비활성화)
    if (process.env.NODE_ENV === 'development') {
      this.logger.debug(`[JWT] User authenticated successfully: ${user.email}, role: ${user.role}`);
    }

    return user;
  }
} 