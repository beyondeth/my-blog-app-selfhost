import { Injectable, ExecutionContext, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get the request object
    const request = context.switchToHttp().getRequest();

    // Log for debugging (development only)
    if (process.env.NODE_ENV === "development") {
      this.logger.debug("Checking for authentication");
      this.logger.debug(
        `Cookies: ${request.cookies ? Object.keys(request.cookies).join(", ") : "No cookies"}`,
      );
    }

    // Optional 인증: JWT 검증을 시도하되 실패해도 요청은 통과.
    // (비로그인 공개 페이지에서도 follow-info 같은 엔드포인트가 401 없이 동작해야 함)
    try {
      await super.canActivate(context);
    } catch (error: any) {
      if (process.env.NODE_ENV === "development") {
        this.logger.debug(
          `Optional auth failed but allowed: ${error?.message || "unknown"}`,
        );
      }
    }
    return true;
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    // Log the authentication result (development only)
    // 민감정보 (user.id) 제거
    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `Authentication result: error=${err ? err.message : "none"}, user=${user ? "authenticated" : "null"}, info=${info ? info.message : "none"}`,
      );
    }

    // Don't throw error if authentication fails
    // Just return null user which will be available in the request
    if (err || !user) {
      if (process.env.NODE_ENV === "development") {
        this.logger.debug("No valid authentication, proceeding without user");
      }
      return null;
    }

    if (process.env.NODE_ENV === "development") {
      this.logger.debug("User authenticated successfully");
    }
    return user;
  }
}
