import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type StrategyOptions } from "passport-google-oauth20";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";
import { AuthProvider } from "../../users/entities/user.entity";
import {
  isDefaultOAuthCallback,
  isPlaceholderValue,
  isProductionEnvironment,
} from "../../config/environment.config";

type GoogleStrategyOptions = StrategyOptions & {
  accessType?: string;
  prompt?: string;
  state?: boolean;
  includeGrantedScopes?: boolean;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  private readonly isConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const isProduction = isProductionEnvironment();
    const clientID = configService.get<string>("GOOGLE_CLIENT_ID");
    const clientSecret = configService.get<string>("GOOGLE_CLIENT_SECRET");
    const callbackURL = configService.get<string>("GOOGLE_CALLBACK_URL");
    const hasAnySetting =
      [clientID, clientSecret].some((value) => Boolean(value?.trim())) ||
      (Boolean(callbackURL?.trim()) &&
        !isPlaceholderValue(callbackURL) &&
        !isDefaultOAuthCallback(callbackURL, "google"));
    const isConfigured =
      !isPlaceholderValue(clientID) &&
      !isPlaceholderValue(clientSecret) &&
      !isPlaceholderValue(callbackURL) &&
      (!isProduction || !isDefaultOAuthCallback(callbackURL, "google"));

    if (isProduction && hasAnySetting && !isConfigured) {
      throw new Error(
        "Google OAuth configuration is partial or uses a placeholder; provide GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_CALLBACK_URL together",
      );
    }

    const strategyOptions: GoogleStrategyOptions = {
      clientID:
        clientID ||
        (isProduction
          ? "disabled-google-provider"
          : "development-google-client-id"),
      clientSecret:
        clientSecret ||
        (isProduction
          ? "disabled-google-provider"
          : "development-google-client-secret"),
      ...(callbackURL || !isProduction
        ? {
            callbackURL:
              callbackURL ||
              "http://localhost:3000/api/v1/auth/google/callback",
          }
        : {}),
      scope: ["email", "profile"],
      // Google OAuth 2.0 공식 문서 권장 설정
      accessType: "offline", // refresh token 받기 위해 필요
      prompt: "consent select_account", // 계정 선택 + 동의 화면 표시
      includeGrantedScopes: true, // 점진적 권한 부여
    };

    super(strategyOptions);

    this.isConfigured = isConfigured;
  }

  authenticate(request: any, options?: any): void {
    if (!this.isConfigured) {
      return this.error(new Error("Google OAuth is not configured"));
    }

    super.authenticate(request, options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    if (!this.isConfigured) {
      throw new Error("Google OAuth is not configured");
    }

    const result = await this.authService.validateOAuthUser(
      profile,
      AuthProvider.GOOGLE,
    );
    return result;
  }
}
