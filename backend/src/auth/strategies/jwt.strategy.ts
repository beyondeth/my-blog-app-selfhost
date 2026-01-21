import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";
import { User } from "../../users/entities/user.entity";
import { Request } from "express";
import { UnifiedRedisService } from "../../redis/unified-redis.service";

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
      secretOrKey: configService.get("JWT_SECRET"),
    });
  }

  async validate(payload: any) {
    // JWT payload has 'sub' field (standard claim)
    const userId = payload.sub || payload.id;
    const tokenType = payload.tokenType;

    // 개발 환경 및 프로덕션에서 모두 로깅 (보안 마스킹 적용)
    this.logger.log(
      `[JWT] Token validation - userId: ${userId ? userId.substring(0, 8) + "..." : "null"}, type: ${tokenType}`,
    );

    // 개발 환경에서 더 상세한 디버그 로그 추가
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `[JWT] Starting validation for token type: ${tokenType}`,
      );
      this.logger.debug(
        `[JWT] User ID (masked): ${userId ? userId.substring(0, 8) + "..." : "null"}`,
      );
    }

    const expectedIssuer = this.configService.get<string>(
      "JWT_ISSUER",
      "codebase.blog",
    );
    const expectedAudience = this.configService.get<string>(
      "JWT_AUDIENCE",
      "codebase.blog::api",
    );

    if (!userId) {
      this.logger.error("[JWT] No userId found in JWT payload");
      return null;
    }

    if (!payload.iss || payload.iss !== expectedIssuer) {
      this.logger.error(
        `[JWT] Invalid issuer: expected ${expectedIssuer}, received ${payload.iss}`,
      );
      return null;
    }

    const payloadAudience = Array.isArray(payload.aud)
      ? payload.aud
      : [payload.aud];
    if (
      !payloadAudience.some(
        (aud) => typeof aud === "string" && aud === expectedAudience,
      )
    ) {
      this.logger.error(
        `[JWT] Invalid audience: expected ${expectedAudience}, received ${payload.aud}`,
      );
      return null;
    }

    if (tokenType !== "access") {
      this.logger.error(`[JWT] Invalid token type: ${tokenType}`);
      return null;
    }

    const cacheKey = `user_validate_${userId}_${tokenType}`; // 토큰 타입도 포함하여 격리 강화

    // 1. 캐시에서 사용자 정보 조회
    const cachedUser: User = await this.unifiedRedisService.getCache(
      "sessions",
      cacheKey,
    );
    if (cachedUser) {
      this.logger.log(
        `[JWT] Cache HIT for user: ${cachedUser.email} (ID: ${cachedUser.id.substring(0, 8)}...), cacheKey: ${cacheKey}`,
      );
      return cachedUser;
    }

    // 2. 캐시에 없으면 DB에서 조회
    this.logger.log(
      `[JWT] Cache MISS for user ID: ${userId.substring(0, 8)}..., cacheKey: ${cacheKey}`,
    );
    const user = await this.usersService.findById(userId);

    if (!user) {
      this.logger.error("[JWT] User not found in database");
      return null;
    }

    await this.usersService.refreshUserStatus(user);

    if (user.isBanned) {
      this.logger.warn("[JWT] User account is permanently banned");
      throw new ForbiddenException({
        statusCode: 403,
        message: "계정이 영구 차단되었습니다. 관리자에게 문의해주세요.",
        error: "Forbidden",
        code: "ACCOUNT_BANNED",
        reason: user.banReason,
        bannedAt: user.bannedAt,
      });
    }

    if (
      user.suspensionUntil &&
      new Date(user.suspensionUntil).getTime() > Date.now()
    ) {
      const suspensionEnd = new Date(user.suspensionUntil);
      const remainingMs = suspensionEnd.getTime() - Date.now();
      const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

      this.logger.warn(
        `[JWT] User account is suspended until ${user.suspensionUntil}`,
      );

      throw new ForbiddenException({
        statusCode: 403,
        message: `계정이 정지되었습니다. ${suspensionEnd.toLocaleString("ko-KR")}까지 로그인할 수 없습니다.`,
        error: "Forbidden",
        code: "ACCOUNT_SUSPENDED",
        reason: user.suspensionReason,
        suspensionUntil: suspensionEnd,
        remainingDays,
      });
    }

    if (!user.isActive) {
      this.logger.warn("[JWT] User account is not active");
      return null;
    }

    // 삭제된 사용자 로그인 차단 (소프트 삭제)
    if (user.isDeleted) {
      this.logger.warn("[JWT] User account has been deleted");
      return null;
    }

    // 3. DB 조회 결과를 캐시에 저장
    // TTL 개선: 5초에서 30분으로 연장 (토큰 만료 시 자동 갱신)
    const cacheTTL = this.configService.get<number>("JWT_CACHE_TTL", 1800); // 30분
    await this.unifiedRedisService.setCache(
      "sessions",
      cacheKey,
      user,
      cacheTTL,
    );

    // 디버그를 위해 관리자 로그 추가 (프로덕션에서는 비활성화)
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `[JWT] User authenticated successfully: ${user.email}, role: ${user.role}`,
      );
    }

    return user;
  }
}
