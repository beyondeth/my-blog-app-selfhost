import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { Request } from 'express';
import { UnifiedRedisService } from '../../redis/unified-redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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

    // 개발 환경에서도 너무 빈번한 로그는 제거
    // 에러와 중요 이벤트만 로그로 남김

    if (!userId) {
      console.error('[JWT Validate] No userId found in payload');
      return null;
    }

    if (tokenType !== 'access') {
      console.error('[JWT Validate] Invalid token type:', tokenType);
      return null;
    }

    const cacheKey = `user_validate_${userId}`;

    // 1. 캐시에서 사용자 정보 조회 - 로그 제거 (너무 빈번함)
    const cachedUser = await this.unifiedRedisService.getCache('sessions', cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    // 2. 캐시에 없으면 DB에서 조회 - 중요 이벤트이므로 로그 유지
    if (process.env.NODE_ENV === 'development') {
      console.log('[JWT Validate] Cache miss, fetching from DB:', userId);
    }
    const user = await this.usersService.findById(userId);

    if (!user) {
      console.error('[JWT Validate] User not found in database:', userId);
      return null;
    }

    if (!user.isActive) {
      console.error('[JWT Validate] User is not active:', userId);
      return null;
    }

    // 삭제된 사용자 로그인 차단 (소프트 삭제)
    if (user.isDeleted) {
      console.error('[JWT Validate] User account has been deleted:', userId);
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

    // 성공 로그도 제거 (너무 빈번함)
    return user;
  }
} 