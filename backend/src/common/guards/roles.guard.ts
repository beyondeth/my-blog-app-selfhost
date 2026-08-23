import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "../enums/role.enum";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import { AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import { SecurityMetricsService } from "../services/security-metrics.service";

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(
    private reflector: Reflector,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly securityMetrics?: SecurityMetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const route = request.route?.path || request.url;

    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If it's a public route, skip role checking
    if (isPublic) {
      this.logger.debug(
        `[RolesGuard] Route "${route}" is public, skipping role check`,
      );
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      this.logger.debug(
        `[RolesGuard] Route "${route}" has no required roles, allowing access`,
      );
      return true;
    }

    const { user } = request;

    if (!user) {
      this.logger.error(
        `[RolesGuard] No user found in request for route "${route}"`,
      );
      this.recordAccessDenied(request, route, requiredRoles, undefined);
      this.securityMetrics?.recordAuthorizationDenial("role");
      return false;
    }

    // 사용자 정보 상세 로깅 (민감정보 마스킹)
    const userId = user.id ? user.id.substring(0, 8) + "..." : "unknown";
    const userEmail = user.email ? user.email.split("@")[0] + "***" : "unknown";

    this.logger.debug(`[RolesGuard] Route: "${route}"`);
    this.logger.debug(`[RolesGuard] User ID: ${userId}, Email: ${userEmail}`);
    this.logger.debug(
      `[RolesGuard] User role: "${user.role}" (type: ${typeof user.role})`,
    );
    this.logger.debug(
      `[RolesGuard] Required roles: ${JSON.stringify(requiredRoles)}`,
    );

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (hasRole) {
      this.logger.debug(
        `[RolesGuard] Access granted for user "${userEmail}" with role "${user.role}"`,
      );
    } else {
      this.logger.warn(
        `[RolesGuard] Access denied for user "${userEmail}" with role "${user.role}", required: ${JSON.stringify(requiredRoles)}`,
      );
      this.recordAccessDenied(request, route, requiredRoles, user);
      this.securityMetrics?.recordAuthorizationDenial("role");
    }

    return hasRole;
  }

  private recordAccessDenied(
    request: any,
    route: string,
    requiredRoles: Role[],
    user?: { id?: string; role?: string },
  ): void {
    void this.auditService
      ?.logSecurityEvent(
        AuditAction.ADMIN_ACCESS_DENIED,
        {
          route,
          requiredRoles,
          actualRole: user?.role || null,
        },
        {
          userId: user?.id,
          organizationId: request.organizationContext?.organizationId,
          ipAddress: request.ip,
          userAgent: request.headers?.["user-agent"],
          requestId: request.requestId,
        },
      )
      .catch((error) =>
        this.logger.warn(`Failed to persist access denial audit: ${error}`),
      );
  }
}
