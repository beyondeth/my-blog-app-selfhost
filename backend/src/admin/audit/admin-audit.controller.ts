import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuditService } from "../../audit/audit.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Role } from "../../common/enums/role.enum";
import { Roles } from "../../common/decorators/roles.decorator";
import { OrganizationContextGuard } from "../../organizations/guards/organization-context.guard";
import {
  OrganizationId,
  RequireOrganizationContext,
} from "../../organizations/decorators/organization-context.decorator";
import { AdminAuditQueryDto } from "./admin-audit-query.dto";

@Controller("admin/audit")
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationContextGuard)
@Roles(Role.ADMIN)
@RequireOrganizationContext()
export class AdminAuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get("logs")
  async listLogs(
    @Query() query: AdminAuditQueryDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.auditService.findOrganizationLogs(
      {
        action: query.action,
        entityType: query.entityType,
        entityId: query.entityId,
        performedById: query.performedById,
        requestId: query.requestId,
        organizationId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      },
      query.page,
      query.limit,
    );
  }
}
