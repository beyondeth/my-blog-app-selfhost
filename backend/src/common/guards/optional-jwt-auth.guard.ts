import { Injectable, ExecutionContext, Logger } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(OptionalJwtAuthGuard.name);

  canActivate(context: ExecutionContext) {
    // Get the request object
    const request = context.switchToHttp().getRequest();

    // Log for debugging (development only)
    if (process.env.NODE_ENV === "development") {
      this.logger.debug("Checking for authentication");
      this.logger.debug(
        `Cookies: ${request.cookies ? Object.keys(request.cookies).join(", ") : "No cookies"}`,
      );
    }

    // Try to authenticate
    return super.canActivate(context);
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
