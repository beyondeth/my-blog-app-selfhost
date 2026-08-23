import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Request,
  DefaultValuePipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Roles } from "../../common/decorators/roles.decorator";
import { Role } from "../../common/enums/role.enum";
import { OrganizationContextGuard } from "../../organizations/guards/organization-context.guard";
import {
  OrganizationId,
  RequireOrganizationContext,
} from "../../organizations/decorators/organization-context.decorator";
import { CommunityOrganizationGuard } from "../../communities/guards/community-organization.guard";
import {
  AdminCommunitiesService,
  CaptureSnapshotDto,
  LockCommunityDto,
} from "./admin-communities.service";

@Controller("admin/communities")
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
  OrganizationContextGuard,
  CommunityOrganizationGuard,
)
@Roles(Role.ADMIN)
@RequireOrganizationContext()
export class AdminCommunitiesController {
  constructor(
    private readonly adminCommunitiesService: AdminCommunitiesService,
  ) {}

  /**
   * 커뮤니티 스냅샷 목록 조회
   */
  @Get(":communityId/recovery-snapshots")
  async listSnapshots(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @OrganizationId() organizationId: string,
  ) {
    return this.adminCommunitiesService.listSnapshots(
      communityId,
      limit,
      organizationId,
    );
  }

  /**
   * 수동 스냅샷 생성
   */
  @Post(":communityId/recovery-snapshots")
  async captureSnapshot(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Body() body: CaptureSnapshotDto,
    @Request() req: any,
    @OrganizationId() organizationId: string,
  ) {
    const snapshot = await this.adminCommunitiesService.captureSnapshot(
      communityId,
      req.user.id,
      body,
      organizationId,
    );
    return {
      success: true,
      data: snapshot,
    };
  }

  /**
   * 스냅샷 기반 복구
   */
  @Post("recovery-snapshots/:snapshotId/restore")
  async restoreSnapshot(
    @Param("snapshotId", ParseUUIDPipe) snapshotId: string,
    @Request() req: any,
    @OrganizationId() organizationId: string,
  ) {
    await this.adminCommunitiesService.restoreSnapshot(
      snapshotId,
      req.user.id,
      organizationId,
    );
    return {
      success: true,
      message: "커뮤니티가 스냅샷을 기준으로 복구되었습니다.",
    };
  }

  /**
   * 커뮤니티 잠금
   */
  @Post(":communityId/lock")
  async lockCommunity(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Body() body: LockCommunityDto,
    @Request() req: any,
    @OrganizationId() organizationId: string,
  ) {
    await this.adminCommunitiesService.lockCommunity(
      communityId,
      req.user.id,
      body,
      organizationId,
    );
    return {
      success: true,
      message: "커뮤니티가 잠금되었습니다.",
    };
  }

  /**
   * 커뮤니티 잠금 해제
   */
  @Post(":communityId/unlock")
  async unlockCommunity(
    @Param("communityId", ParseUUIDPipe) communityId: string,
    @Body() body: LockCommunityDto,
    @Request() req: any,
    @OrganizationId() organizationId: string,
  ) {
    await this.adminCommunitiesService.unlockCommunity(
      communityId,
      req.user.id,
      body,
      organizationId,
    );
    return {
      success: true,
      message: "커뮤니티 잠금이 해제되었습니다.",
    };
  }
}
