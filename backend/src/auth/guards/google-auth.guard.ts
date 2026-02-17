import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import {
  appendQueryParams,
  decodeMobileOAuthState,
  encodeMobileOAuthState,
  parseAllowedMobileSchemes,
  sanitizeMobileRedirectUri,
} from "../utils/oauth-mobile-redirect.util";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  private readonly allowedMobileSchemes: Set<string>;

  constructor(private configService: ConfigService) {
    super();
    this.allowedMobileSchemes = parseAllowedMobileSchemes(
      this.configService.get<string>("MOBILE_AUTH_REDIRECT_SCHEMES"),
    );
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const mobileRedirectUri = sanitizeMobileRedirectUri(
      request?.query?.redirect_uri,
      this.allowedMobileSchemes,
    );

    const options: Record<string, string> = {
      // 매 로그인 시 계정 선택 UI를 강제해 기존 세션 자동 선택을 피한다.
      prompt: "select_account consent",
      accessType: "offline",
      includeGrantedScopes: "true",
    };

    if (!mobileRedirectUri) {
      return options;
    }

    options.state = encodeMobileOAuthState(mobileRedirectUri);
    return options;
  }

  /**
   * OAuth 에러 처리
   * Strategy에서 UnauthorizedException 발생 시 프론트엔드로 에러 정보 전달
   */
  handleRequest(err, user, info, context: ExecutionContext) {
    const response = context.switchToHttp().getResponse();

    if (err || !user) {
      // 에러 코드 및 메시지 추출
      const errorCode = err?.response?.code || "auth_failed";
      const errorMessage = err?.response?.message || err?.message || "로그인 실패";
      const encodedErrorMessage = encodeURIComponent(errorMessage);
      const remainingDays = String(err?.response?.remainingDays || 0);
      const reason = encodeURIComponent(err?.response?.reason || "");
      const suspensionUntil = encodeURIComponent(
        err?.response?.suspensionUntil || "",
      );

      const frontendUrl =
        this.configService.get("FRONTEND_URL") || "http://localhost:3001";

      const mobileRedirectUri = this.resolveMobileRedirectUri(context);
      if (mobileRedirectUri) {
        return response.redirect(
          appendQueryParams(mobileRedirectUri, {
            error: errorCode,
            message: errorMessage,
            remainingDays,
          }),
        );
      }

      // 프론트엔드 콜백 페이지로 상세 에러 정보와 함께 리다이렉트
      return response.redirect(
        `${frontendUrl}/auth/callback?error=${errorCode}&message=${encodedErrorMessage}&remainingDays=${remainingDays}&reason=${reason}&until=${suspensionUntil}`,
      );
    }

    return user;
  }

  private resolveMobileRedirectUri(context: ExecutionContext): string | null {
    const request = context.switchToHttp().getRequest();
    const statePayload = decodeMobileOAuthState(request?.query?.state);
    return sanitizeMobileRedirectUri(
      statePayload?.mobileRedirectUri,
      this.allowedMobileSchemes,
    );
  }
}
