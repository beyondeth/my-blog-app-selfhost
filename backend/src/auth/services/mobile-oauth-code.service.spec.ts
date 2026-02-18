import { ConfigService } from "@nestjs/config";
import {
  MobileOAuthCodeExchangeError,
  MobileOAuthCodeService,
} from "./mobile-oauth-code.service";
import { UnifiedRedisService } from "../../redis/unified-redis.service";

describe("MobileOAuthCodeService", () => {
  const mockRedisService = {
    setWithExpiry: jest.fn(),
    consumeOnce: jest.fn(),
  } as unknown as UnifiedRedisService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === "MOBILE_OAUTH_CODE_TTL_SECONDS") return "90";
      if (key === "MOBILE_OAUTH_CODE_SECRET") return "test-secret";
      return undefined;
    }),
  } as unknown as ConfigService;

  let service: MobileOAuthCodeService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MobileOAuthCodeService(mockRedisService, mockConfigService);
  });

  it("issues one-time code with expiry", async () => {
    const result = await service.issueCode({
      accessToken: "access-token",
      refreshToken: "refresh-token",
      userId: "user-1",
      provider: "google",
      redirectUri: "codebase://auth/callback",
      needsConsent: false,
    });

    expect(result.code).toBeTruthy();
    expect(result.expiresInSeconds).toBe(90);
    expect((mockRedisService.setWithExpiry as jest.Mock).mock.calls.length).toBe(
      1,
    );
  });

  it("exchanges valid code and returns token payload", async () => {
    (mockRedisService.consumeOnce as jest.Mock).mockResolvedValue(
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userId: "user-1",
        provider: "google",
        redirectUri: "codebase://auth/callback",
        needsConsent: true,
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 30_000,
      }),
    );

    const result = await service.exchangeCode({
      code: "one-time-code",
      redirectUri: "codebase://auth/callback",
      provider: "google",
    });

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.provider).toBe("google");
    expect(result.needsConsent).toBe(true);
  });

  it("rejects redirect uri mismatch", async () => {
    (mockRedisService.consumeOnce as jest.Mock).mockResolvedValue(
      JSON.stringify({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        userId: "user-1",
        provider: "google",
        redirectUri: "codebase://auth/callback",
        needsConsent: false,
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 30_000,
      }),
    );

    await expect(
      service.exchangeCode({
        code: "one-time-code",
        redirectUri: "myblog://auth/callback",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MobileOAuthCodeExchangeError>>({
        code: "OAUTH_CODE_BIND_MISMATCH",
      }),
    );
  });

  it("rejects used or missing code", async () => {
    (mockRedisService.consumeOnce as jest.Mock).mockResolvedValue(null);

    await expect(
      service.exchangeCode({
        code: "unknown",
        redirectUri: "codebase://auth/callback",
      }),
    ).rejects.toEqual(
      expect.objectContaining<Partial<MobileOAuthCodeExchangeError>>({
        code: "OAUTH_CODE_USED",
      }),
    );
  });
});

