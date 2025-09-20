import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Get the request object
    const request = context.switchToHttp().getRequest();

    // Get metrics path from environment
    const metricsPath = process.env.METRICS_PATH || '/internal/health-check-2f4a8b9c';

    // Block the old /metrics endpoint completely (return 404)
    if (request.url === '/metrics') {
      // Don't throw 401 or 403 - make it look like the endpoint doesn't exist
      const response = context.switchToHttp().getResponse();
      response.status(404).json({
        statusCode: 404,
        message: 'Cannot GET /metrics',
        error: 'Not Found'
      });
      return false;
    }

    // Handle the actual metrics endpoint
    if (request.url === metricsPath) {
      const clientIp = request.ip || request.connection?.remoteAddress || '';
      const allowedIps = process.env.METRICS_ALLOWED_IPS?.split(',').map(ip => ip.trim())
        || ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];

      // Check if IP is allowed
      if (!allowedIps.includes(clientIp)) {
        // Return 404 for unauthorized IPs (hide the existence of this endpoint)
        const response = context.switchToHttp().getResponse();
        response.status(404).json({
          statusCode: 404,
          message: `Cannot GET ${request.url}`,
          error: 'Not Found'
        });
        return false;
      }

      // Allow Prometheus from allowed IPs
      return true;
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

  handleRequest(err, user, info, context: ExecutionContext) {
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