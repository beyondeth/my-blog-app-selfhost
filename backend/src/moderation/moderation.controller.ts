import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  Query,
} from "@nestjs/common";
import { ModerationService } from "./moderation.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";

@ApiTags("moderation")
@Controller("moderation")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN) // 관리자 전용
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post("ban-user")
  @ApiOperation({ summary: "유저 계정 정지" })
  async banUser(
    @CurrentUser() admin: User,
    @Body() body: { userId: string; reason: string; memo?: string; evidence?: any },
  ) {
    return this.moderationService.banUser(
      admin.id,
      body.userId,
      body.reason,
      body.memo,
      body.evidence,
    );
  }

  @Post("block-ip")
  @ApiOperation({ summary: "IP 차단" })
  async blockIp(
    @CurrentUser() admin: User,
    @Body() body: { ip: string; reason: string; memo?: string; userId?: string },
  ) {
    return this.moderationService.blockIp(
      admin.id,
      body.ip,
      body.reason,
      body.memo,
      body.userId,
    );
  }

  @Post("unblock-ip")
  @ApiOperation({ summary: "IP 차단 해제" })
  async unblockIp(
    @CurrentUser() admin: User,
    @Body() body: { ip: string },
  ) {
    return this.moderationService.unblockIp(admin.id, body.ip);
  }

  @Post("suspend-user")
  @ApiOperation({ summary: "유저 계정 일시 정지" })
  async suspendUser(
    @CurrentUser() admin: User,
    @Body() body: { userId: string; durationDays: number; reason: string; memo?: string },
  ) {
    return this.moderationService.suspendUser(
      admin.id,
      body.userId,
      body.durationDays,
      body.reason,
      body.memo,
    );
  }

  @Post("unban-user")
  @ApiOperation({ summary: "유저 차단 해제" })
  async unbanUser(
    @CurrentUser() admin: User,
    @Body() body: { userId: string },
  ) {
    return this.moderationService.unbanUser(admin.id, body.userId);
  }

  @Get("blocked-ips")
  @ApiOperation({ summary: "차단된 IP 목록 조회" })
  async getBlockedIps(@CurrentUser() admin: User) {
    return this.moderationService.getBlockedIps(admin.id);
  }

  @Get("logs")
  @ApiOperation({ summary: "전체 또는 유저별 로그 조회" })
  async getLogs(@Query("userId") userId?: string) {
    return this.moderationService.getLogs(userId);
  }

  @Get("context/:type/:id")
  @ApiOperation({ summary: "모더레이션 컨텍스트 조회 (IP 포함)" })
  async getContext(
    @CurrentUser() admin: User,
    @Param("type") type: "post" | "comment", 
    @Param("id") id: string,
  ) {
    return this.moderationService.getModerationContext(type, id, admin.id);
  }
}
