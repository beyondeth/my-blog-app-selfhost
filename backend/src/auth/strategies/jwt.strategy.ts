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
          const hasCookies = request?.cookies && Object.keys(request.cookies).length > 0;

          if (!hasCookies) {
            console.log('[JWT Extract] No cookies found in request');
          } else {
            console.log('[JWT Extract] Available cookies:', Object.keys(request.cookies));
            console.log('[JWT Extract] Access token found:', !!token);
            if (token) {
              // 토큰의 첫 20자와 마지막 10자만 로그 (보안)
              const tokenPreview = token.length > 30
                ? `${token.substring(0, 20)}...${token.substring(token.length - 10)}`
                : 'token too short';
              console.log('[JWT Extract] Token preview:', tokenPreview);
            }
          }

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
    const issuedAt = payload.iat ? new Date(payload.iat * 1000) : null;
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;

    console.log('[JWT Validate] Payload details:', {
      userId,
      email: payload.email,
      tokenType,
      issuedAt: issuedAt?.toISOString(),
      expiresAt: expiresAt?.toISOString(),
      remainingTime: expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / 1000) + ' seconds' : 'unknown'
    });

    if (!userId) {
      console.error('[JWT Validate] No userId found in payload');
      return null;
    }

    if (tokenType !== 'access') {
      console.error('[JWT Validate] Invalid token type:', tokenType);
      return null;
    }

    const cacheKey = `user_validate_${userId}`;

    // 1. 캐시에서 사용자 정보 조회
    const cachedUser = await this.cacheManager.get(cacheKey);
    if (cachedUser) {
      console.log('[JWT Validate] User found in cache:', userId);
      return cachedUser;
    }

    // 2. 캐시에 없으면 DB에서 조회
    console.log('[JWT Validate] Fetching user from database:', userId);
    const user = await this.usersService.findById(userId);

    if (!user) {
      console.error('[JWT Validate] User not found in database:', userId);
      return null;
    }

    if (!user.isActive) {
      console.error('[JWT Validate] User is not active:', userId);
      return null;
    }

    // 3. DB 조회 결과를 캐시에 저장 (환경변수로 설정, 기본 5초)
    const cacheTTL = this.configService.get<number>('JWT_CACHE_TTL', 5000);
    console.log(`[JWT Validate] Caching user for ${cacheTTL}ms:`, userId);
    await this.cacheManager.set(
      cacheKey,
      user,
      cacheTTL
    );

    console.log('[JWT Validate] Validation successful for user:', userId);
    return user;
  }
} 