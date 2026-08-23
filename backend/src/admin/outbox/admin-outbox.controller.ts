import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuditService } from "../../audit/audit.service";
import { AuditAction } from "../../audit/entities/audit-log.entity";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Role } from "../../common/enums/role.enum";
import { OutboxService } from "../../common/services/outbox.service";
import { OrganizationContextGuard } from "../../organizations/guards/organization-context.guard";
import {
  OrganizationId,
  RequireOrganizationContext,
} from "../../organizations/decorators/organization-context.decorator";

@Controller("admin/outbox")
@UseGuards(JwtAuthGuard, RolesGuard, OrganizationContextGuard)
@Roles(Role.ADMIN)
@RequireOrganizationContext()
export class AdminOutboxController {
  constructor(
    private readonly outboxService: OutboxService,
    private readonly auditService: AuditService,
  ) {}

  @Get("dead-letters")
  async listDeadLetters(
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @OrganizationId() organizationId: string,
  ) {
    return this.outboxService.listDeadLetters(limit, organizationId);
  }

  @Post(":id/replay")
  async replayDeadLetter(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() request: any,
    @OrganizationId() organizationId: string,
  ) {
    const event = await this.outboxService.replayDeadLetter(id, organizationId);
    const user = request.user as { id: string };

    await this.auditService.log(
      {
        action: AuditAction.OUTBOX_DEAD_LETTERED,
        entityType: "outbox_event",
        entityId: id,
        newData: { status: event.status },
        metadata: {
          operation: "replay_dead_letter",
          eventType: event.eventType,
          aggregateType: event.aggregateType,
          aggregateId: event.aggregateId,
        },
      },
      {
        userId: user.id,
        organizationId: event.organizationId || undefined,
        ipAddress: request.ip,
        userAgent: request.get("user-agent") || undefined,
      },
    );

    return {
      id: event.id,
      status: event.status,
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      requestId: event.requestId,
      availableAt: event.availableAt,
    };
  }
}
