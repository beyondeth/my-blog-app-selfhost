import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { isUUID } from "class-validator";
import { OrganizationsService } from "../organizations.service";
import { REQUIRE_ORGANIZATION_CONTEXT } from "../decorators/organization-context.decorator";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { RequestContextService } from "../../common/services/request-context.service";
import { AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import { SecurityMetricsService } from "../../common/services/security-metrics.service";

const ORGANIZATION_ID_HEADER = "x-organization-id";

@Injectable()
export class OrganizationContextGuard implements CanActivate {
  private readonly logger = new Logger(OrganizationContextGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly organizationsService: OrganizationsService,
    private readonly requestContextService: RequestContextService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly securityMetrics?: SecurityMetricsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<boolean>(
      REQUIRE_ORGANIZATION_CONTEXT,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id;

    if (!userId) {
      throw new UnauthorizedException("Organization context requires login");
    }

    const rawOrganizationId = request.headers[ORGANIZATION_ID_HEADER];
    const organizationId = Array.isArray(rawOrganizationId)
      ? rawOrganizationId[0]
      : rawOrganizationId;

    if (organizationId !== undefined && !isUUID(organizationId)) {
      throw new BadRequestException("X-Organization-Id must be a UUID");
    }

    try {
      request.organizationContext =
        await this.organizationsService.resolveContext(userId, organizationId);
    } catch (error) {
      this.securityMetrics?.recordAuthorizationDenial("organization");
      void this.auditService
        ?.logSecurityEvent(
          AuditAction.ORGANIZATION_ACCESS_DENIED,
          {
            requestedOrganizationId: organizationId || null,
            reason: error instanceof Error ? error.message : "unknown",
          },
          {
            userId,
            organizationId,
            ipAddress: request.ip,
            userAgent: request.headers?.["user-agent"],
            requestId: request.requestId,
          },
        )
        .catch((auditError) =>
          this.logger.warn(
            `Failed to persist organization denial audit: ${auditError}`,
          ),
        );
      throw error;
    }
    this.requestContextService.update({
      organizationId: request.organizationContext.organizationId,
    });

    return true;
  }
}
