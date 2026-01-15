import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Get the request object
    const request = context.switchToHttp().getRequest();

    // Get metrics path from environment
    const metricsPath =
      process.env.METRICS_PATH || "/internal/health-check-2f4a8b9c";

    // Block the old /metrics endpoint completely (return 404)
    if (request.url === "/metrics") {
      // Don't throw 401 or 403 - make it look like the endpoint doesn't exist
      const response = context.switchToHttp().getResponse();
      response.status(404).json({
        statusCode: 404,
        message: "Cannot GET /metrics",
        error: "Not Found",
      });
      return false;
    }

    // Handle the actual metrics endpoint
    if (request.url === metricsPath) {
      const clientIp = request.ip || request.connection?.remoteAddress || "";
      const allowedIps = process.env.METRICS_ALLOWED_IPS?.split(",").map((ip) =>
        ip.trim(),
      ) || ["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"];

      // Check if IP is allowed
      if (!allowedIps.includes(clientIp)) {
        // Return 404 for unauthorized IPs (hide the existence of this endpoint)
        const response = context.switchToHttp().getResponse();
        response.status(404).json({
          statusCode: 404,
          message: `Cannot GET ${request.url}`,
          error: "Not Found",
        });
        return false;
      }

      // Allow Prometheus from allowed IPs
      return true;
    }

    // OAuth 엔드포인트는 선택적 JWT 인증 처리
    // 토큰이 있으면 사용, 없으면 통과 (컨트롤러에서 처리)
    const oauthPaths = [
      "/api/v1/oauth/authorize-data",
      "/api/v1/oauth/authorize",
    ];

    // URL에서 쿼리 파라미터 제거하고 경로만 비교
    const requestPath = request.path || request.url.split("?")[0];

    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `Request path: ${requestPath}, method: ${request.method}`,
      );
    }

    if (oauthPaths.includes(requestPath)) {
      this.logger.debug("OAuth endpoint detected - optional JWT handling");
      // OAuth 엔드포인트는 JWT 검증을 시도하되, 실패해도 통과
      // OptionalJwtAuthGuard가 실제 처리를 담당
      const result = super.canActivate(context);

      // Promise인 경우 에러를 catch하고, 아닌 경우 그대로 반환
      if (result instanceof Promise) {
        return result.catch((err) => {
          this.logger.debug(
            `JWT validation failed but allowed for OAuth path: ${err?.message}`,
          );
          return true;
        });
      }

      // Observable이나 boolean인 경우
      return result;
    }

    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If it's a public route, skip authentication
    if (isPublic) {
      return true;
    }

    // Otherwise, proceed with JWT authentication
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();

    // OAuth 엔드포인트 확인
    const oauthPaths = [
      "/api/v1/oauth/authorize-data",
      "/api/v1/oauth/authorize",
    ];
    const requestPath = request.path || request.url.split("?")[0];

    if (process.env.NODE_ENV === "development") {
      this.logger.debug(
        `handleRequest - Path: ${requestPath}, User: ${user ? "exists" : "null"}, Error: ${err?.message || "none"}`,
      );
    }

    // OAuth 엔드포인트는 사용자가 없어도 통과 (컨트롤러에서 처리)
    if (oauthPaths.includes(requestPath)) {
      this.logger.debug("OAuth path - returning user or null");
      return user || null;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 인증된 사용자가 있으면 user 객체를 반환
    if (user) {
      return user;
    }

    // Public 경로인 경우, 인증되지 않았어도 에러를 던지지 않음
    if (isPublic) {
      return null;
    }

    // 보호된 경로인데 사용자가 없는 경우 에러 발생
    throw err || new UnauthorizedException();
  }
}
