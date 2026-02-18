import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "crypto";
import { UnifiedRedisService } from "../../redis/unified-redis.service";

export type SocialProvider = "google" | "github" | "kakao";

type IssueMobileOAuthCodeInput = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  provider: SocialProvider;
  redirectUri: string;
  needsConsent: boolean;
};

type StoredMobileOAuthCodePayload = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  provider: SocialProvider;
  redirectUri: string;
  needsConsent: boolean;
  issuedAt: number;
  expiresAt: number;
};

export type MobileOAuthCodeExchangeResult = {
  accessToken: string;
  refreshToken: string;
  userId: string;
  provider: SocialProvider;
  needsConsent: boolean;
};

export class MobileOAuthCodeExchangeError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_CODE_INVALID"
      | "OAUTH_CODE_EXPIRED"
      | "OAUTH_CODE_USED"
      | "OAUTH_CODE_BIND_MISMATCH",
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class MobileOAuthCodeService {
  private readonly codeSecret: string;
  private readonly defaultTTLSeconds: number;

  constructor(
    private readonly redisService: UnifiedRedisService,
    private readonly configService: ConfigService,
  ) {
    this.codeSecret =
      this.configService.get<string>("MOBILE_OAUTH_CODE_SECRET") ||
      this.configService.get<string>("JWT_SECRET") ||
      "mobile-oauth-code-secret";
    this.defaultTTLSeconds = Math.max(
      30,
      Number(this.configService.get<string>("MOBILE_OAUTH_CODE_TTL_SECONDS")) ||
        90,
    );
  }

  async issueCode(input: IssueMobileOAuthCodeInput): Promise<{
    code: string;
    expiresInSeconds: number;
  }> {
    const code = randomBytes(32).toString("base64url");
    const hashedCode = this.hashCode(code);
    const now = Date.now();
    const expiresAt = now + this.defaultTTLSeconds * 1000;

    const payload: StoredMobileOAuthCodePayload = {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      userId: input.userId,
      provider: input.provider,
      redirectUri: input.redirectUri,
      needsConsent: input.needsConsent,
      issuedAt: now,
      expiresAt,
    };

    await this.redisService.setWithExpiry(
      this.keyForHash(hashedCode),
      JSON.stringify(payload),
      this.defaultTTLSeconds,
    );

    return {
      code,
      expiresInSeconds: this.defaultTTLSeconds,
    };
  }

  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    provider?: string;
  }): Promise<MobileOAuthCodeExchangeResult> {
    const hashedCode = this.hashCode(input.code);
    const key = this.keyForHash(hashedCode);
    const rawPayload = await this.redisService.consumeOnce(key);

    if (!rawPayload) {
      throw new MobileOAuthCodeExchangeError(
        "OAUTH_CODE_USED",
        "이미 사용되었거나 유효하지 않은 OAuth 코드입니다.",
      );
    }

    let payload: StoredMobileOAuthCodePayload;
    try {
      payload = JSON.parse(rawPayload) as StoredMobileOAuthCodePayload;
    } catch {
      throw new MobileOAuthCodeExchangeError(
        "OAUTH_CODE_INVALID",
        "OAuth 코드 데이터를 해석할 수 없습니다.",
      );
    }

    if (!payload.expiresAt || payload.expiresAt < Date.now()) {
      throw new MobileOAuthCodeExchangeError(
        "OAUTH_CODE_EXPIRED",
        "만료된 OAuth 코드입니다.",
      );
    }

    if (payload.redirectUri !== input.redirectUri) {
      throw new MobileOAuthCodeExchangeError(
        "OAUTH_CODE_BIND_MISMATCH",
        "OAuth 코드의 redirect URI가 일치하지 않습니다.",
      );
    }

    if (input.provider && payload.provider !== input.provider) {
      throw new MobileOAuthCodeExchangeError(
        "OAUTH_CODE_BIND_MISMATCH",
        "OAuth 코드의 provider가 일치하지 않습니다.",
      );
    }

    return {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      userId: payload.userId,
      provider: payload.provider,
      needsConsent: payload.needsConsent,
    };
  }

  private hashCode(code: string): string {
    return createHmac("sha256", this.codeSecret).update(code).digest("hex");
  }

  private keyForHash(hash: string): string {
    return `temp:mobile_oauth:code:${hash}`;
  }
}

