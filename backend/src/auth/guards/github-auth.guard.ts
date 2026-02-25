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
export class GitHubAuthGuard extends AuthGuard("github") {
  private readonly allowedMobileSchemes: Set<string>;
  private readonly oauthStateSecret: string;

  constructor(private configService: ConfigService) {
    super();
    this.allowedMobileSchemes = parseAllowedMobileSchemes(
      this.configService.get<string>("MOBILE_AUTH_REDIRECT_SCHEMES"),
    );
    this.oauthStateSecret = this.configService.get<string>("JWT_SECRET") ?? "";
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const mobileRedirectUri = sanitizeMobileRedirectUri(
      request?.query?.redirect_uri,
      this.allowedMobileSchemes,
    );

    const options: Record<string, string> = {
      // GitHub OAuth에서 계정 자동선택을 피하고 계정 선택 화면을 강제한다.
      prompt: "select_account",
    };

    if (!mobileRedirectUri) {
      return options;
    }

    options.state = encodeMobileOAuthState(
      mobileRedirectUri,
      this.oauthStateSecret,
    );
    return options;
  }

  canActivate(context: ExecutionContext) {
    // Check if GitHub OAuth is configured
    const clientId = this.configService.get("GITHUB_CLIENT_ID");
    const clientSecret = this.configService.get("GITHUB_CLIENT_SECRET");

    if (
      !clientId ||
      !clientSecret ||
      clientId === "your-github-client-id" ||
      clientId === "dummy-client-id"
    ) {
      // If not configured, don't use the guard
      // The controller will handle the error response
      return false;
    }

    return super.canActivate(context);
  }

  /**
   * OAuth 에러 처리
   * Strategy에서 UnauthorizedException 발생 시 프론트엔드로 에러 정보 전달
   */
  handleRequest(err, user, info, context: ExecutionContext) {
    const response = context.switchToHttp().getResponse();

    if (err || !user) {
      // 에러 코드 및 메시지 추출
      const errorCode = err?.response?.code || "oauth_error";
      const errorMessage =
        err?.response?.message || err?.message || "로그인 실패";
      const encodedErrorMessage = encodeURIComponent(errorMessage);
      const remainingDays = String(err?.response?.remainingDays || 0);
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

      // 프론트엔드 콜백 페이지로 에러 정보와 함께 리다이렉트
      return response.redirect(
        `${frontendUrl}/auth/callback?error=${errorCode}&message=${encodedErrorMessage}&remainingDays=${remainingDays}`,
      );
    }

    return user;
  }

  private resolveMobileRedirectUri(context: ExecutionContext): string | null {
    const request = context.switchToHttp().getRequest();
    const statePayload = decodeMobileOAuthState(
      request?.query?.state,
      this.oauthStateSecret,
    );
    return sanitizeMobileRedirectUri(
      statePayload?.mobileRedirectUri,
      this.allowedMobileSchemes,
    );
  }
}
