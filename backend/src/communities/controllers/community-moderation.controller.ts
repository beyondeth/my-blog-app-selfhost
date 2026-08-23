import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CommunityRolesGuard } from "../guards/community-roles.guard";
import { CommunityOrganizationGuard } from "../guards/community-organization.guard";
import { OrganizationContextGuard } from "../../organizations/guards/organization-context.guard";
import { RequireOrganizationContext } from "../../organizations/decorators/organization-context.decorator";
import {
  CommunityRoles,
  ModeratorOnly,
  OwnerOnly,
} from "../decorators/community-roles.decorator";
import { CommunityRole } from "../enums";
import { CommunityMembershipService } from "../services";
import {
  BanMemberDto,
  UpdateMemberRoleDto,
  JoinApplicationDto,
  HandleApplicationDto,
  CreateInviteDto,
} from "../dto";
import { PaginationDto } from "../../common/dto/pagination.dto";

/**
 * 커뮤니티 모더레이션 컨트롤러
 *
 * @description 멤버 관리, 차단, 역할 변경 API
 *
 * 엔드포인트:
 * - GET /api/v1/community/:slug/members: 멤버 목록
 * - PUT /api/v1/community/:slug/members/:userId/role: 역할 변경
 * - POST /api/v1/community/:slug/members/:userId/ban: 멤버 차단
 * - DELETE /api/v1/community/:slug/members/:userId/ban: 차단 해제
 * - GET /api/v1/community/:slug/bans: 차단 목록
 * - POST /api/v1/community/:slug/transfer-ownership: 소유권 이전
 */
@ApiTags("Community Moderation")
@Controller("community/:slug")
@UseGuards(OrganizationContextGuard, CommunityOrganizationGuard)
@RequireOrganizationContext()
export class CommunityModerationController {
  constructor(private readonly membershipService: CommunityMembershipService) {}

  // =========================================================================
  // 멤버 관리
  // =========================================================================

  /**
   * 멤버 목록 조회
   */
  @Get("members")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @CommunityRoles(
    CommunityRole.OWNER,
    CommunityRole.MODERATOR,
    CommunityRole.MEMBER,
  )
  @ApiBearerAuth()
  @ApiOperation({ summary: "멤버 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "멤버 목록 반환" })
  async getMembers(
    @Query() query: PaginationDto,
    @Query("role") role: CommunityRole,
    @Request() req: any,
  ) {
    const community = req.community;
    const result = await this.membershipService.getMembers(
      community.id,
      query,
      role,
    );

    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((m) => ({
          id: m.id,
          userId: m.userId,
          role: m.role,
          status: m.status,
          joinedAt: m.joinedAt,
          // user 정보 (ModeratorList와 동일한 형식)
          user: m.user
            ? {
                id: m.user.id,
                username: m.user.username,
                profileImage: m.user.profile?.profileImage || null,
              }
            : null,
        })),
      },
    };
  }

  /**
   * 멤버 역할 변경
   */
  @Put("members/:userId/role")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @OwnerOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "멤버 역할 변경" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "역할 변경 성공" })
  @ApiResponse({ status: 403, description: "권한 없음 (소유자만 가능)" })
  async updateRole(
    @Param("userId") targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const moderatorId = req.user.id;

    const updated = await this.membershipService.updateRole(
      community.id,
      targetUserId,
      dto,
      moderatorId,
    );

    return {
      success: true,
      message: `역할이 ${dto.role}(으)로 변경되었습니다.`,
      data: {
        userId: updated.userId,
        role: updated.role,
      },
    };
  }

  /**
   * 소유권 이전
   */
  @Post("transfer-ownership/:userId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @OwnerOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "소유권 이전" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "userId", description: "새 소유자 ID" })
  @ApiResponse({ status: 200, description: "소유권 이전 성공" })
  @ApiResponse({ status: 403, description: "권한 없음" })
  async transferOwnership(
    @Param("userId") newOwnerId: string,
    @Request() req: any,
  ) {
    const community = req.community;
    const currentOwnerId = req.user.id;

    await this.membershipService.transferOwnership(
      community.id,
      newOwnerId,
      currentOwnerId,
    );

    return {
      success: true,
      message: "소유권이 성공적으로 이전되었습니다.",
    };
  }

  // =========================================================================
  // 차단 관리
  // =========================================================================

  /**
   * 멤버 차단
   */
  @Post("members/:userId/ban")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "멤버 차단" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "차단 성공" })
  @ApiResponse({ status: 403, description: "모더레이터 이상은 차단 불가" })
  @ApiResponse({ status: 409, description: "이미 차단됨" })
  async banMember(
    @Param("userId") targetUserId: string,
    @Body() dto: BanMemberDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const moderatorId = req.user.id;

    const ban = await this.membershipService.banMember(
      community.id,
      targetUserId,
      dto,
      moderatorId,
    );

    return {
      success: true,
      message: dto.durationDays
        ? `${dto.durationDays}일간 차단되었습니다.`
        : "영구 차단되었습니다.",
      data: ban.toPublicJSON(),
    };
  }

  /**
   * 차단 해제
   */
  @Delete("members/:userId/ban")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "차단 해제" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "차단 해제 성공" })
  @ApiResponse({ status: 404, description: "차단 기록 없음" })
  async unbanMember(
    @Param("userId") targetUserId: string,
    @Request() req: any,
  ) {
    const community = req.community;
    const moderatorId = req.user.id;

    await this.membershipService.unbanMember(
      community.id,
      targetUserId,
      moderatorId,
    );

    return {
      success: true,
      message: "차단이 해제되었습니다.",
    };
  }

  /**
   * 차단 목록 조회
   */
  @Get("bans")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "차단 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "차단 목록 반환" })
  async getBans(@Query() query: PaginationDto, @Request() req: any) {
    const community = req.community;
    const result = await this.membershipService.getBans(community.id, query);

    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((b) => b.toPublicJSON()),
      },
    };
  }

  // =========================================================================
  // 가입 승인 관리 (RESTRICTED 커뮤니티)
  // =========================================================================

  /**
   * 대기 중인 가입 신청 목록 조회
   */
  @Get("applications")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "가입 신청 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "가입 신청 목록 반환" })
  async getPendingApplications(
    @Query() query: PaginationDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const result = await this.membershipService.getPendingApplications(
      community.id,
      query,
    );

    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((m) => ({
          id: m.id,
          userId: m.userId,
          applicationMessage: m.applicationMessage,
          joinedAt: m.joinedAt,
          user: m.user
            ? {
                id: m.user.id,
                username: m.user.username,
                profileImage: m.user.profile?.profileImage || null,
              }
            : null,
        })),
      },
    };
  }

  /**
   * 가입 신청 승인
   */
  @Post("applications/:userId/approve")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "가입 신청 승인" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "승인 성공" })
  @ApiResponse({ status: 404, description: "대기 중인 신청 없음" })
  async approveApplication(
    @Param("userId") targetUserId: string,
    @Request() req: any,
  ) {
    const community = req.community;
    const moderatorId = req.user.id;

    await this.membershipService.approveApplication(
      community.id,
      targetUserId,
      moderatorId,
    );

    return {
      success: true,
      message: "가입 신청이 승인되었습니다.",
    };
  }

  /**
   * 가입 신청 거부
   */
  @Post("applications/:userId/reject")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "가입 신청 거부" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "userId", description: "대상 사용자 ID" })
  @ApiResponse({ status: 200, description: "거부 성공" })
  @ApiResponse({ status: 404, description: "대기 중인 신청 없음" })
  async rejectApplication(
    @Param("userId") targetUserId: string,
    @Body() dto: HandleApplicationDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const moderatorId = req.user.id;

    await this.membershipService.rejectApplication(
      community.id,
      targetUserId,
      moderatorId,
      dto,
    );

    return {
      success: true,
      message: "가입 신청이 거부되었습니다.",
    };
  }

  // =========================================================================
  // 초대 링크 관리
  // =========================================================================

  /**
   * 초대 링크 생성
   */
  @Post("invites")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "초대 링크 생성" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 201, description: "초대 링크 생성 성공" })
  @ApiResponse({ status: 400, description: "공개 커뮤니티는 초대 불필요" })
  async createInvite(@Body() dto: CreateInviteDto, @Request() req: any) {
    const community = req.community;
    const creatorId = req.user.id;

    const invite = await this.membershipService.createInvite(
      community.id,
      creatorId,
      dto,
    );

    return {
      success: true,
      message: "초대 링크가 생성되었습니다.",
      data: invite.toPublicJSON(),
    };
  }

  /**
   * 초대 링크 목록 조회
   */
  @Get("invites")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "초대 링크 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "초대 링크 목록 반환" })
  async getInvites(@Query() query: PaginationDto, @Request() req: any) {
    const community = req.community;
    const result = await this.membershipService.getInvites(community.id, query);

    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((i) => i.toPublicJSON()),
      },
    };
  }

  /**
   * 초대 링크 비활성화 (삭제)
   */
  @Delete("invites/:inviteId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "초대 링크 삭제" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "inviteId", description: "초대 ID" })
  @ApiResponse({ status: 200, description: "삭제 성공" })
  @ApiResponse({ status: 404, description: "초대 링크 없음" })
  async revokeInvite(@Param("inviteId") inviteId: string, @Request() req: any) {
    const community = req.community;
    const moderatorId = req.user.id;

    await this.membershipService.revokeInvite(
      community.id,
      inviteId,
      moderatorId,
    );

    return {
      success: true,
      message: "초대 링크가 삭제되었습니다.",
    };
  }
}
