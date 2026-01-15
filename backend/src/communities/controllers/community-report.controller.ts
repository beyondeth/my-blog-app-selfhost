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
  ApiQuery,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CommunityRolesGuard } from "../guards/community-roles.guard";
import {
  CommunityRoles,
  ModeratorOnly,
  AdminOnly,
} from "../decorators/community-roles.decorator";
import { CommunityRole } from "../enums";
import { CommunityReportService } from "../services";
import {
  ReportPostDto,
  ReportCommentDto,
  HandleReportDto,
  GetReportsQueryDto,
  CreateRemovalReasonDto,
  UpdateRemovalReasonDto,
} from "../dto";

/**
 * 커뮤니티 신고 컨트롤러
 *
 * @description 게시물/댓글 신고 및 모더레이션 큐 API
 *
 * 엔드포인트:
 * - POST /api/v1/community/:slug/posts/:postId/report: 게시물 신고
 * - POST /api/v1/community/:slug/comments/:commentId/report: 댓글 신고
 * - GET /api/v1/community/:slug/mod/reports: 신고 목록 (모더레이터용)
 * - PATCH /api/v1/community/:slug/mod/reports/:reportId: 신고 처리
 * - GET /api/v1/community/:slug/mod/queue: 모드 큐
 * - CRUD /api/v1/community/:slug/removal-reasons: 삭제 사유 관리
 */
@ApiTags("Community Reports")
@Controller("community/:slug")
export class CommunityReportController {
  constructor(private readonly reportService: CommunityReportService) {}

  // =========================================================================
  // 신고 생성 (일반 사용자)
  // =========================================================================

  /**
   * 게시물 신고
   */
  @Post("posts/:postId/report")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @CommunityRoles(
    CommunityRole.OWNER,
    CommunityRole.MODERATOR,
    CommunityRole.MEMBER,
  )
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "게시물 신고" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 201, description: "신고 접수됨" })
  @ApiResponse({ status: 400, description: "자신의 게시물은 신고 불가" })
  @ApiResponse({ status: 409, description: "이미 신고함" })
  async reportPost(
    @Param("postId") postId: string,
    @Body() dto: ReportPostDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const userId = req.user.id;

    const report = await this.reportService.reportPost(
      community.id,
      postId,
      dto,
      userId,
    );

    return {
      success: true,
      message: "신고가 접수되었습니다. 검토 후 조치하겠습니다.",
      data: { reportId: report.id },
    };
  }

  /**
   * 댓글 신고
   */
  @Post("comments/:commentId/report")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @CommunityRoles(
    CommunityRole.OWNER,
    CommunityRole.MODERATOR,
    CommunityRole.MEMBER,
  )
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "댓글 신고" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "commentId", description: "댓글 ID" })
  @ApiResponse({ status: 201, description: "신고 접수됨" })
  @ApiResponse({ status: 400, description: "자신의 댓글은 신고 불가" })
  @ApiResponse({ status: 409, description: "이미 신고함" })
  async reportComment(
    @Param("commentId") commentId: string,
    @Body() dto: ReportCommentDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const userId = req.user.id;

    const report = await this.reportService.reportComment(
      community.id,
      commentId,
      dto,
      userId,
    );

    return {
      success: true,
      message: "신고가 접수되었습니다. 검토 후 조치하겠습니다.",
      data: { reportId: report.id },
    };
  }

  // =========================================================================
  // 신고 관리 (모더레이터)
  // =========================================================================

  /**
   * 신고 목록 조회
   */
  @Get("mod/reports")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "신고 목록 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "신고 목록 반환" })
  async getReports(@Query() query: GetReportsQueryDto, @Request() req: any) {
    const community = req.community;
    const result = await this.reportService.getReports(community.id, query);

    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((r) => r.toPublicJSON()),
      },
    };
  }

  /**
   * 단일 신고 조회
   */
  @Get("mod/reports/:reportId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "단일 신고 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "reportId", description: "신고 ID" })
  @ApiResponse({ status: 200, description: "신고 상세 정보" })
  @ApiResponse({ status: 404, description: "신고를 찾을 수 없음" })
  async getReport(@Param("reportId") reportId: string, @Request() req: any) {
    const community = req.community;
    const report = await this.reportService.getReport(community.id, reportId);

    return {
      success: true,
      data: report.toPublicJSON(),
    };
  }

  /**
   * 신고 처리 (resolve/dismiss/escalate)
   */
  @Put("mod/reports/:reportId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "신고 처리" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "reportId", description: "신고 ID" })
  @ApiResponse({ status: 200, description: "신고 처리 완료" })
  @ApiResponse({ status: 400, description: "이미 처리된 신고" })
  @ApiResponse({ status: 404, description: "신고를 찾을 수 없음" })
  async handleReport(
    @Param("reportId") reportId: string,
    @Body() dto: HandleReportDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const moderatorId = req.user.id;

    const report = await this.reportService.handleReport(
      community.id,
      reportId,
      dto,
      moderatorId,
    );

    return {
      success: true,
      message: `신고가 ${dto.status === "resolved" ? "처리" : dto.status === "dismissed" ? "기각" : "에스컬레이션"}되었습니다.`,
      data: report.toPublicJSON(),
    };
  }

  // =========================================================================
  // 모드 큐 (Mod Queue)
  // =========================================================================

  /**
   * 모드 큐 조회
   */
  @Get("mod/queue")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "모드 큐 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiQuery({
    name: "type",
    enum: ["reports", "spam", "removed"],
    required: true,
  })
  @ApiResponse({ status: 200, description: "모드 큐 콘텐츠" })
  async getModQueue(
    @Query("type") type: "reports" | "spam" | "removed",
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
    @Request() req: any,
  ) {
    const community = req.community;
    const result = await this.reportService.getModQueue(
      community.id,
      type,
      page,
      limit,
    );

    return {
      success: true,
      data: {
        ...result,
        items: result.items.map((item: any) =>
          item.toPublicJSON ? item.toPublicJSON() : item,
        ),
      },
    };
  }

  // =========================================================================
  // 삭제 사유 관리 (커뮤니티 관리자)
  // =========================================================================

  /**
   * 삭제 사유 목록 조회
   */
  @Get("removal-reasons")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "삭제 사유 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "삭제 사유 목록" })
  async getRemovalReasons(@Request() req: any) {
    const community = req.community;
    const reasons = await this.reportService.getRemovalReasons(community.id);

    return {
      success: true,
      data: reasons.map((r) => r.toPublicJSON()),
    };
  }

  /**
   * 삭제 사유 생성
   */
  @Post("removal-reasons")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "삭제 사유 생성" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 201, description: "삭제 사유 생성됨" })
  async createRemovalReason(
    @Body() dto: CreateRemovalReasonDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const reason = await this.reportService.createRemovalReason(
      community.id,
      dto,
    );

    return {
      success: true,
      message: "삭제 사유가 생성되었습니다.",
      data: reason.toPublicJSON(),
    };
  }

  /**
   * 삭제 사유 수정
   */
  @Put("removal-reasons/:reasonId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "삭제 사유 수정" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "reasonId", description: "삭제 사유 ID" })
  @ApiResponse({ status: 200, description: "삭제 사유 수정됨" })
  @ApiResponse({ status: 404, description: "삭제 사유를 찾을 수 없음" })
  async updateRemovalReason(
    @Param("reasonId") reasonId: string,
    @Body() dto: UpdateRemovalReasonDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const reason = await this.reportService.updateRemovalReason(
      community.id,
      reasonId,
      dto,
    );

    return {
      success: true,
      message: "삭제 사유가 수정되었습니다.",
      data: reason.toPublicJSON(),
    };
  }

  /**
   * 삭제 사유 삭제
   */
  @Delete("removal-reasons/:reasonId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @AdminOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "삭제 사유 삭제" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "reasonId", description: "삭제 사유 ID" })
  @ApiResponse({ status: 200, description: "삭제 사유 삭제됨" })
  @ApiResponse({ status: 404, description: "삭제 사유를 찾을 수 없음" })
  async deleteRemovalReason(
    @Param("reasonId") reasonId: string,
    @Request() req: any,
  ) {
    const community = req.community;
    await this.reportService.deleteRemovalReason(community.id, reasonId);

    return {
      success: true,
      message: "삭제 사유가 삭제되었습니다.",
    };
  }
}
