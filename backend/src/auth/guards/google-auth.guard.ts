import { Injectable, ExecutionContext } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { consumeOAuthState, issueOAuthState } from "./oauth-state.util";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  constructor(private configService: ConfigService) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.query?.code) {
      consumeOAuthState(request, "google", request.query?.state);
    }

    return super.canActivate(context);
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (request.query?.code) {
      return {};
    }

    const { state, nonce } = issueOAuthState(request, "google");
    return {
      state,
      nonce,
    };
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
      // 메시지 인코딩 강화
      const errorMessage = encodeURIComponent(
        err?.response?.message || err?.message || "로그인 실패",
      );
      const remainingDays = err?.response?.remainingDays || 0;
      const reason = encodeURIComponent(err?.response?.reason || "");
      const suspensionUntil = encodeURIComponent(
        err?.response?.suspensionUntil || "",
      );

      const frontendUrl =
        this.configService.get("FRONTEND_URL") || "http://localhost:3001";

      // 프론트엔드 콜백 페이지로 상세 에러 정보와 함께 리다이렉트
      return response.redirect(
        `${frontendUrl}/auth/callback?error=${errorCode}&message=${errorMessage}&remainingDays=${remainingDays}&reason=${reason}&until=${suspensionUntil}`,
      );
    }

    return user;
  }
}
