import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, Logger, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { UsersService } from "../../users/users.service";
import { User } from "../../users/entities/user.entity";
import { Request } from "express";
import { UnifiedRedisService } from "../../redis/unified-redis.service";

type CachedAuthPrincipal = {
  id: string;
  username: string | null;
  role: User["role"];
  authProvider: User["authProvider"] | null;
  isEmailVerified: boolean;
  isActive: boolean;
  isDeleted: boolean;
  suspensionUntil: Date | null;
  suspensionReason: string | null;
  isBanned: boolean;
  banReason: string | null;
  bannedAt: Date | null;
  createdAt: Date | null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  // UUID v1~v8 공통 허용 (v7 포함)
  private readonly uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const rawUserId = payload?.sub ?? payload?.id;
    const userId = rawUserId == null ? "" : String(rawUserId);
    const tokenType = payload.tokenType;

    // 개발 환경 및 프로덕션에서 모두 로깅 (보안 마스킹 적용)
    this.logger.log(
      `[JWT] Token validation - userId: ${this.maskUserId(userId)}, type: ${tokenType}`,
    );

    // 개발 환경에서 더 상세한 디버그 로그 추가
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `[JWT] Starting validation for token type: ${tokenType}`,
      );
      this.logger.debug(`[JWT] User ID (masked): ${this.maskUserId(userId)}`);
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

    // 레거시/손상 토큰 방어: UUID 형식이 아니면 인증 실패 처리 (500 방지)
    if (!this.uuidPattern.test(userId)) {
      this.logger.warn(
        `[JWT] Invalid userId format in token payload: ${this.maskUserId(userId)}`,
      );
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
    const cachedPrincipal =
      await this.unifiedRedisService.getCache<CachedAuthPrincipal>(
        "sessions",
        cacheKey,
      );
    if (cachedPrincipal) {
      const principal = this.hydratePrincipal(cachedPrincipal, payload);
      this.logger.log(
        `[JWT] Cache HIT for user: ${this.maskEmail(principal.email)} (ID: ${this.maskUserId(principal.id)}), cacheKey: ${cacheKey}`,
      );
      return principal;
    }

    // 2. 캐시에 없으면 DB에서 조회
    this.logger.log(
      `[JWT] Cache MISS for user ID: ${this.maskUserId(userId)}, cacheKey: ${cacheKey}`,
    );
    const user = await this.usersService.findByIdForAuth(userId);

    if (!user) {
      this.logger.error("[JWT] User not found in database");
      return null;
    }

    await this.usersService.refreshUserStatus(user);

    if (user.isBanned) {
      this.logger.warn("[JWT] User account is permanently banned");
      throw new ForbiddenException({
        statusCode: 403,
        message: "This account has been permanently banned. Contact support for assistance.",
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
        message: `Your account is suspended until ${suspensionEnd.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })}.`,
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
    const principal = this.buildPrincipal(user, payload);
    // 민감한 이메일은 Redis 캐시에 저장하지 않고 요청 컨텍스트에서만 사용한다.
    const cachePrincipal: CachedAuthPrincipal = {
      id: principal.id,
      username: principal.username ?? null,
      role: principal.role,
      authProvider: principal.authProvider ?? null,
      isEmailVerified: !!principal.isEmailVerified,
      isActive: !!principal.isActive,
      isDeleted: !!principal.isDeleted,
      suspensionUntil: principal.suspensionUntil ?? null,
      suspensionReason: principal.suspensionReason ?? null,
      isBanned: !!principal.isBanned,
      banReason: principal.banReason ?? null,
      bannedAt: principal.bannedAt ?? null,
      createdAt: principal.createdAt ?? null,
    };
    await this.unifiedRedisService.setCache(
      "sessions",
      cacheKey,
      cachePrincipal,
      cacheTTL,
    );

    // 디버그를 위해 관리자 로그 추가 (프로덕션에서는 비활성화)
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `[JWT] User authenticated successfully: ${user.email}, role: ${user.role}`,
      );
    }

    return principal;
  }

  private maskUserId(value: unknown): string {
    if (value == null) {
      return "null";
    }
    const raw = String(value);
    if (raw.length <= 8) {
      return raw;
    }
    return `${raw.substring(0, 8)}...`;
  }

  private maskEmail(value: unknown): string {
    if (!value || typeof value !== "string") {
      return "unknown";
    }
    const [local, domain] = value.split("@");
    if (!local || !domain) {
      return "unknown";
    }
    return `${local.substring(0, 2)}***@${domain}`;
  }

  private buildPrincipal(user: User, payload: any): User {
    return {
      id: user.id,
      email: user.email ?? payload?.email ?? null,
      username: user.username ?? null,
      role: user.role,
      authProvider: user.authProvider ?? null,
      isEmailVerified: !!user.isEmailVerified,
      isActive: !!user.isActive,
      isDeleted: !!user.isDeleted,
      suspensionUntil: user.suspensionUntil ?? null,
      suspensionReason: user.suspensionReason ?? null,
      isBanned: !!user.isBanned,
      banReason: user.banReason ?? null,
      bannedAt: user.bannedAt ?? null,
      createdAt: user.createdAt ?? null,
      lastLoginProvider: payload?.lastLoginProvider ?? null,
    } as User;
  }

  private hydratePrincipal(cached: CachedAuthPrincipal, payload: any): User {
    return {
      id: cached.id,
      email: payload?.email ?? null,
      username: cached.username ?? null,
      role: cached.role,
      authProvider: cached.authProvider ?? null,
      isEmailVerified: !!cached.isEmailVerified,
      isActive: !!cached.isActive,
      isDeleted: !!cached.isDeleted,
      suspensionUntil: cached.suspensionUntil ?? null,
      suspensionReason: cached.suspensionReason ?? null,
      isBanned: !!cached.isBanned,
      banReason: cached.banReason ?? null,
      bannedAt: cached.bannedAt ?? null,
      createdAt: cached.createdAt ?? null,
      lastLoginProvider: payload?.lastLoginProvider ?? null,
    } as User;
  }
}
