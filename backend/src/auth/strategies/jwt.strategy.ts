import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { Request } from 'express';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 쿠키에서 토큰 추출
        (request: Request) => {
          const token = request?.cookies?.access_token;
          console.log('[JWT Extract] Cookies:', Object.keys(request?.cookies || {}));
          console.log('[JWT Extract] Token found:', !!token);
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
    console.log('[JWT Validate] Payload:', { sub: payload.sub, id: payload.id, email: payload.email });

    if (!userId) {
      console.error('[JWT Validate] No userId found in payload');
      return null;
    }

    const cacheKey = `user_validate_${userId}`;
    
    // 1. 캐시에서 사용자 정보 조회
    const cachedUser = await this.cacheManager.get(cacheKey);
    if (cachedUser) {
      return cachedUser;
    }

    // 2. 캐시에 없으면 DB에서 조회
    const user = await this.usersService.findById(userId);
    
    // 3. DB 조회 결과를 캐시에 저장 (2초)
    if (user) {
      await this.cacheManager.set(cacheKey, user, 2000);
    }

    return user;
  }
} 