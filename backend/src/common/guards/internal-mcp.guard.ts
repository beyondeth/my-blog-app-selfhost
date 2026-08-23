import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";
import { AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import { SecurityMetricsService } from "../services/security-metrics.service";

/**
 * Authenticate requests sent from the MCP proxy to the backend.
 *
 * The proxy is a separate public-facing process, so network placement alone
 * is not an authentication boundary.  In production a shared secret is
 * mandatory; development keeps the existing local workflow usable when no
 * secret has been configured.
 */
@Injectable()
export class InternalMcpGuard implements CanActivate {
  private readonly logger = new Logger(InternalMcpGuard.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly securityMetrics?: SecurityMetricsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    try {
      assertInternalMcpSecret(request, this.configService, this.logger);
    } catch (error) {
      this.securityMetrics?.recordInternalAuthFailure("mcp");
      void this.auditService
        ?.logSecurityEvent(
          AuditAction.INTERNAL_AUTH_FAILED,
          {
            path: request.path || request.url,
            method: request.method,
          },
          {
            userId: request.user?.id,
            organizationId: request.organizationContext?.organizationId,
            ipAddress: request.ip,
            userAgent: request.headers?.["user-agent"],
            requestId: request.requestId,
          },
        )
        .catch((auditError) =>
          this.logger.warn(
            `Failed to persist internal auth audit: ${auditError}`,
          ),
        );
      throw error;
    }
    return true;
  }
}

/**
 * Shared implementation used by both controller-level internal endpoints and
 * the API-key guard.  Keep comparison timing-safe and fail closed in
 * production when the secret is missing.
 */
export function assertInternalMcpSecret(
  request: any,
  configService: ConfigService,
  logger?: Logger,
): void {
  const expectedSecret = configService.get<string>("MCP_SHARED_SECRET")?.trim();
  const isProduction = configService.get<string>("NODE_ENV") === "production";

  if (!expectedSecret) {
    if (isProduction) {
      logger?.error("MCP_SHARED_SECRET is required for internal MCP traffic");
      throw new UnauthorizedException(
        "Internal authentication is not configured",
      );
    }

    return;
  }

  const providedSecret = String(
    request.headers["x-internal-secret"] ??
      request.headers["X-Internal-Secret"] ??
      "",
  ).trim();

  const expectedBuffer = Buffer.from(expectedSecret, "utf8");
  const providedBuffer = Buffer.from(providedSecret, "utf8");

  const isValid =
    expectedBuffer.length === providedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, providedBuffer);

  if (!isValid) {
    logger?.warn("Missing or invalid internal MCP secret");
    throw new UnauthorizedException("Invalid internal signature");
  }
}
