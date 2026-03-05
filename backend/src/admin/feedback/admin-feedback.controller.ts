import { Controller, Get, Patch, Param, Body, Query, UseGuards, ParseIntPipe, DefaultValuePipe } from "@nestjs/common";
import { AdminFeedbackService } from "./admin-feedback.service";
import { FeedbackStatus, FeedbackType } from "../../feedback/entities/feedback-ticket.entity";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";

@Controller("admin/feedback")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MODERATOR)
export class AdminFeedbackController {
  constructor(private readonly adminFeedbackService: AdminFeedbackService) {}

  @Get()
  async findAll(
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query("status") status?: FeedbackStatus,
    @Query("type") type?: FeedbackType,
    @Query("q") q?: string,
  ) {
    return this.adminFeedbackService.findAll({ status, type, q, page, limit });
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body("status") status: FeedbackStatus,
  ) {
    return this.adminFeedbackService.updateStatus(id, status);
  }
}
