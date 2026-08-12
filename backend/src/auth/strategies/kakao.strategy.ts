import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-kakao";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";
import { AuthProvider } from "../../users/entities/user.entity";
import {
  isDefaultOAuthCallback,
  isPlaceholderValue,
  isProductionEnvironment,
} from "../../config/environment.config";

@Injectable()
export class KakaoStrategy extends PassportStrategy(Strategy, "kakao") {
  private readonly isConfigured: boolean;

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const isProduction = isProductionEnvironment();
    const clientID = configService.get<string>("KAKAO_CLIENT_ID");
    const clientSecret = configService.get<string>("KAKAO_CLIENT_SECRET");
    const callbackURL = configService.get<string>("KAKAO_CALLBACK_URL");
    const hasAnySetting =
      [clientID, clientSecret].some((value) => Boolean(value?.trim())) ||
      (Boolean(callbackURL?.trim()) &&
        !isPlaceholderValue(callbackURL) &&
        !isDefaultOAuthCallback(callbackURL, "kakao"));
    const isConfigured =
      !isPlaceholderValue(clientID) &&
      !isPlaceholderValue(clientSecret) &&
      !isPlaceholderValue(callbackURL) &&
      (!isProduction || !isDefaultOAuthCallback(callbackURL, "kakao"));

    if (isProduction && hasAnySetting && !isConfigured) {
      throw new Error(
        "Kakao OAuth configuration is partial or uses a placeholder; provide KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, and KAKAO_CALLBACK_URL together",
      );
    }

    super({
      clientID:
        clientID ||
        (isProduction
          ? "disabled-kakao-provider"
          : "development-kakao-client-id"),
      clientSecret:
        clientSecret ||
        (isProduction
          ? "disabled-kakao-provider"
          : "development-kakao-client-secret"),
      ...(callbackURL || !isProduction
        ? {
            callbackURL:
              callbackURL || "http://localhost:3000/api/v1/auth/kakao/callback",
          }
        : {}),
      // Kakao OAuth 스코프 - 공백으로 구분
      // openid는 OpenID Connect 활성화 시에만 사용
      // account_email은 카카오 개발자 콘솔에서 필수 동의 항목으로 설정해야 함
      scope: "account_email",
      // response_type을 명시적으로 설정
      authorizationParams: {
        response_type: "code",
      },
    });

    this.isConfigured = isConfigured;
  }

  authenticate(request: any, options?: any): void {
    if (!this.isConfigured) {
      return (this as any).error(new Error("Kakao OAuth is not configured"));
    }

    super.authenticate(request, options);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    if (!this.isConfigured) {
      throw new Error("Kakao OAuth is not configured");
    }

    // 카카오 프로필 전체 구조 확인
    console.log("Kakao profile structure:", {
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      emails: profile.emails,
      _json: profile._json,
      _raw: profile._raw,
    });

    // Kakao는 이메일을 다른 방식으로 제공할 수 있음
    if (profile._json) {
      console.log("Kakao _json details:", {
        email: profile._json.email,
        kakao_account: profile._json.kakao_account,
      });

      // kakao_account 안에 이메일이 있을 수 있음
      if (profile._json.kakao_account) {
        console.log("Kakao account details:", profile._json.kakao_account);

        // 이메일을 kakao_account에서 가져와서 profile.emails에 추가
        if (profile._json.kakao_account.email) {
          profile.emails = [
            {
              value: profile._json.kakao_account.email,
              verified: profile._json.kakao_account.is_email_verified || false,
            },
          ];
        }
      }
    }

    const result = await this.authService.validateOAuthUser(
      profile,
      AuthProvider.KAKAO,
    );
    return result;
  }
}
