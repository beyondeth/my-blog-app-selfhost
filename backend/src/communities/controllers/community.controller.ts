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
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { Public } from "../../common/decorators/public.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { RolesGuard } from "../../common/guards/roles.guard";
import { Role } from "../../common/enums/role.enum";
import { CommunityRolesGuard } from "../guards/community-roles.guard";
import { CommunityVisibilityGuard } from "../guards/community-visibility.guard";
import {
  CommunityRoles,
  ModeratorOnly,
  OwnerOnly,
} from "../decorators/community-roles.decorator";
import { CommunitySlug } from "../decorators/community-id.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { User } from "../../users/entities/user.entity";
import { Community } from "../entities/community.entity";
import { CommunityRole, FlairType } from "../enums";
import {
  CommunityService,
  CommunityMembershipService,
  CommunityPostService,
} from "../services";
import { ContextualFileService } from "../../files/services/contextual-file.service";
import {
  CreateCommunityDto,
  UpdateCommunityDto,
  CreateCommunityRuleDto,
  UpdateCommunityRuleDto,
  CreateCommunityFlairDto,
  UpdateCommunityFlairDto,
  GetCommunitiesQueryDto,
  JoinApplicationDto,
} from "../dto";

/**
 * 커뮤니티 컨트롤러
 *
 * @description 커뮤니티 CRUD, 규칙, 플레어 관리 API
 *
 * 엔드포인트:
 * - GET /api/v1/community: 커뮤니티 목록
 * - POST /api/v1/community: 커뮤니티 생성
 * - GET /api/v1/community/:slug: 커뮤니티 상세
 * - PUT /api/v1/community/:slug: 커뮤니티 수정
 * - DELETE /api/v1/community/:slug: 커뮤니티 삭제
 * - 규칙/플레어 관련 하위 엔드포인트
 */
@ApiTags("Community")
@Controller("community")
export class CommunityController {
  private readonly logger = new Logger(CommunityController.name);

  constructor(
    private readonly communityService: CommunityService,
    private readonly membershipService: CommunityMembershipService,
    private readonly postService: CommunityPostService,
    private readonly contextualFileService: ContextualFileService,
  ) {}

  // =========================================================================
  // 커뮤니티 CRUD
  // =========================================================================

  /**
   * 커뮤니티 목록 조회 (커서 페이지네이션)
   *
   * @description 커서 기반 무한 스크롤을 위한 API
   * - 첫 요청: cursor 파라미터 없이 호출
   * - 다음 페이지: 이전 응답의 nextCursor, nextCursorId 사용
   *
   * @Public() - 글로벌 JwtAuthGuard 우회 (비로그인 사용자도 접근 가능)
   * @UseGuards(OptionalJwtAuthGuard) - 로그인한 경우 사용자 정보 추가
   */
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "커뮤니티 목록 조회 (커서 페이지네이션)" })
  @ApiResponse({ status: 200, description: "커뮤니티 목록 반환" })
  async findAll(
    @Query() query: GetCommunitiesQueryDto,
    @Request() req: { user?: { id: string } },
  ) {
    const userId = req.user?.id;
    const result = await this.communityService.findAll(query, userId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 커뮤니티별 최신 게시글 일괄 조회 (Batch API)
   * GET /api/v1/community/batch/recent-posts?ids=1,2,3
   */
  @Get("batch/recent-posts")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "커뮤니티별 최신 게시글 일괄 조회 (Batch API)" })
  @ApiResponse({ status: 200, description: "커뮤니티별 최신 게시글 맵 반환" })
  async getRecentPostsBatch(@Query("ids") ids: string) {
    if (!ids) {
      return { success: true, data: {} };
    }

    const communityIds = ids
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0);
    const postMap =
      await this.postService.getRecentPostsForCommunities(communityIds);

    // Map -> Object 변환 (JSON 응답용)
    const data: Record<string, any[]> = {};
    for (const [communityId, posts] of postMap.entries()) {
      data[communityId] = posts; // 엔티티 그대로 반환하거나 DTO 변환 필요. 여기선 엔티티 사용 (직렬화됨)
    }

    return {
      success: true,
      data,
    };
  }

  /**
   * Sitemap용 커뮤니티 포스트 목록 조회
   *
   * @description SEO sitemap.xml 생성을 위한 공개 커뮤니티 포스트 조회
   * - 공개 커뮤니티의 삭제되지 않은 포스트만 포함
   * - 최소 데이터만 반환 (slug, communitySlug, updatedAt)
   * - 페이지네이션 없이 전체 데이터 반환
   */
  @Get("sitemap/all")
  @Public()
  @ApiOperation({ summary: "Sitemap용 모든 커뮤니티 포스트 조회" })
  @ApiResponse({
    status: 200,
    description: "커뮤니티 포스트 목록 (slug, communitySlug, updatedAt)",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          slug: { type: "string", example: "abc123" },
          communitySlug: { type: "string", example: "programming" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
    },
  })
  async getAllPostsForSitemap(): Promise<
    Array<{ slug: string; communitySlug: string; updatedAt: Date }>
  > {
    return this.communityService.getAllPostsForSitemap();
  }

  /**
   * 커뮤니티 생성
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "커뮤니티 생성" })
  @ApiResponse({ status: 201, description: "커뮤니티 생성 성공" })
  @ApiResponse({ status: 409, description: "이미 사용 중인 slug" })
  async create(@Body() dto: CreateCommunityDto, @CurrentUser() user: User) {
    const userId = user.id;
    const community = await this.communityService.create(userId, dto);

    return {
      success: true,
      message: "커뮤니티가 생성되었습니다.",
      data: community.toPublicJSON(),
    };
  }

  /**
   * 커뮤니티 상세 조회
   * @Public() - 글로벌 JwtAuthGuard 우회 (비로그인 사용자도 접근 가능)
   * @UseGuards(OptionalJwtAuthGuard) - 로그인한 경우 사용자 정보 추가
   */
  @Get(":slug")
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "커뮤니티 상세 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "커뮤니티 상세 정보" })
  @ApiResponse({ status: 404, description: "커뮤니티 없음" })
  async findOne(@CommunitySlug() slug: string, @CurrentUser() user?: User) {
    const userId = user?.id;
    const community = await this.communityService.findBySlug(slug, userId);

    return {
      success: true,
      data: community,
    };
  }

  /**
   * 커뮤니티 수정
   */
  @Put(":slug")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "커뮤니티 수정" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "수정 성공" })
  @ApiResponse({ status: 403, description: "권한 없음" })
  async update(
    @Param("slug") slug: string,
    @Body() dto: UpdateCommunityDto,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    const updated = await this.communityService.update(
      community.id,
      dto,
      userId,
    );

    return {
      success: true,
      message: "커뮤니티가 수정되었습니다.",
      data: updated.toPublicJSON(),
    };
  }

  /**
   * 커뮤니티 삭제 (Site Admin 전용)
   *
   * @description Reddit 정책에 따라 커뮤니티 삭제는 플랫폼 관리자만 가능.
   * 커뮤니티 Owner/Moderator를 포함한 일반 사용자는 커뮤니티를 삭제할 수 없음.
   */
  @Delete(":slug")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "커뮤니티 삭제 (Site Admin 전용)" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 204, description: "삭제 성공" })
  @ApiResponse({
    status: 403,
    description: "권한 없음 (플랫폼 관리자만 삭제 가능)",
  })
  async delete(@Param("slug") slug: string, @CurrentUser() user: User) {
    // Site Admin은 CommunityRolesGuard를 사용하지 않으므로 직접 커뮤니티 조회
    const community = await this.communityService.findBySlug(slug);
    const userId = user.id;

    await this.communityService.delete(community.id, userId);

    return;
  }

  // =========================================================================
  // 이미지 업로드 (V2 ContextualFile)
  // =========================================================================

  /**
   * 커뮤니티 이미지 업로드 (아이콘/배너)
   *
   * @description V2 ContextualFile 시스템을 사용하여 커뮤니티 이미지를 체계적으로 관리
   * - 경로: v2/communities/{communityId}/branding/{icon|banner}/{timestamp}_{uuid}_{purpose}.webp
   * - 기존 이미지 자동 비활성화 (버전 관리)
   * - 30일 후 비활성 파일 자동 정리
   */
  @Post(":slug/upload/:purpose")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor("file"))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "커뮤니티 이미지 업로드 (아이콘/배너)" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({
    name: "purpose",
    description: "이미지 용도",
    enum: ["icon", "banner"],
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: {
          type: "string",
          format: "binary",
          description: "이미지 파일 (최대 10MB, jpg/png/gif/webp)",
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: "업로드 성공" })
  @ApiResponse({ status: 400, description: "잘못된 purpose 또는 파일 형식" })
  @ApiResponse({ status: 403, description: "권한 없음 (모더레이터 이상)" })
  async uploadCommunityImage(
    @Param("slug") slug: string,
    @Param("purpose") purpose: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          // 10MB 제한 (배너 이미지 고려)
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          // 이미지 파일만 허용
          new FileTypeValidator({ fileType: /^image\/(jpeg|png|gif|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Request() req: { user: User; community: Community },
  ) {
    // purpose 유효성 검사
    if (purpose !== "icon" && purpose !== "banner") {
      throw new BadRequestException("purpose는 icon 또는 banner만 가능합니다.");
    }

    const community = req.community;
    const userId = req.user.id;

    // V2 ContextualFile 시스템으로 업로드
    const result = await this.contextualFileService.uploadCommunityAsset(
      userId,
      community.id,
      file,
      purpose as "icon" | "banner",
    );

    // Community 엔티티의 iconUrl/bannerUrl 업데이트
    const updateData =
      purpose === "icon" ? { iconUrl: result.url } : { bannerUrl: result.url };

    await this.communityService.update(community.id, updateData, userId);

    return {
      success: true,
      message: `커뮤니티 ${purpose === "icon" ? "아이콘" : "배너"}가 업로드되었습니다.`,
      data: {
        url: result.url,
        fileId: result.fileId,
        purpose,
      },
    };
  }

  // =========================================================================
  // 가입/탈퇴
  // =========================================================================

  /**
   * 커뮤니티 가입 신청
   *
   * @description OPEN 커뮤니티는 즉시 가입, RESTRICTED는 승인 대기
   */
  @Post(":slug/join")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "커뮤니티 가입 신청" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "가입/신청 성공" })
  @ApiResponse({
    status: 403,
    description: "차단된 사용자 또는 비공개 커뮤니티",
  })
  @ApiResponse({ status: 409, description: "이미 가입됨 또는 승인 대기 중" })
  async join(
    @CommunitySlug() slug: string,
    @Body() dto: JoinApplicationDto,
    @CurrentUser() user: User,
  ) {
    const userId = user.id;
    const community = await this.communityService.findBySlug(slug);

    // applyToJoin은 OPEN 커뮤니티는 바로 가입, RESTRICTED는 pending 상태로 생성
    const membership = await this.membershipService.applyToJoin(
      community.id,
      userId,
      dto,
    );

    return {
      success: true,
      message:
        membership.status === "active"
          ? "커뮤니티에 가입되었습니다."
          : "가입 요청이 접수되었습니다. 승인을 기다려주세요.",
      data: {
        status: membership.status,
        role: membership.role,
      },
    };
  }

  /**
   * 커뮤니티 탈퇴
   */
  @Post(":slug/leave")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "커뮤니티 탈퇴" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "탈퇴 성공" })
  @ApiResponse({ status: 403, description: "소유자는 탈퇴 불가" })
  async leave(@CommunitySlug() slug: string, @CurrentUser() user: User) {
    const userId = user.id;
    const community = await this.communityService.findBySlug(slug);

    await this.membershipService.leave(community.id, userId);

    return {
      success: true,
      message: "커뮤니티에서 탈퇴되었습니다.",
    };
  }

  // =========================================================================
  // 규칙 관리
  // =========================================================================

  /**
   * 규칙 목록 조회
   * @Public() - 글로벌 JwtAuthGuard 우회 (비로그인 사용자도 접근 가능)
   */
  @Get(":slug/rules")
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "커뮤니티 규칙 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  async getRules(@CommunitySlug() slug: string) {
    const community = await this.communityService.findBySlug(slug);
    const rules = await this.communityService.getRules(community.id);

    return {
      success: true,
      data: rules.map((r) => r.toPublicJSON()),
    };
  }

  /**
   * 규칙 생성
   */
  @Post(":slug/rules")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "규칙 생성" })
  async createRule(
    @Param("slug") slug: string,
    @Body() dto: CreateCommunityRuleDto,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    const rule = await this.communityService.createRule(
      community.id,
      dto,
      userId,
    );

    return {
      success: true,
      message: "규칙이 추가되었습니다.",
      data: rule.toPublicJSON(),
    };
  }

  /**
   * 규칙 수정
   */
  @Put(":slug/rules/:ruleId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "규칙 수정" })
  async updateRule(
    @Param("slug") slug: string,
    @Param("ruleId") ruleId: string,
    @Body() dto: UpdateCommunityRuleDto,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    const rule = await this.communityService.updateRule(
      community.id,
      ruleId,
      dto,
      userId,
    );

    return {
      success: true,
      message: "규칙이 수정되었습니다.",
      data: rule.toPublicJSON(),
    };
  }

  /**
   * 규칙 삭제
   */
  @Delete(":slug/rules/:ruleId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "규칙 삭제" })
  async deleteRule(
    @Param("slug") slug: string,
    @Param("ruleId") ruleId: string,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    await this.communityService.deleteRule(community.id, ruleId, userId);

    return;
  }

  // =========================================================================
  // 플레어 관리
  // =========================================================================

  /**
   * 플레어 목록 조회
   * @Public() - 글로벌 JwtAuthGuard 우회 (비로그인 사용자도 접근 가능)
   */
  @Get(":slug/flairs")
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "플레어 목록 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  async getFlairs(
    @CommunitySlug() slug: string,
    @Query("type") type?: FlairType,
  ) {
    const community = await this.communityService.findBySlug(slug);
    const flairs = await this.communityService.getFlairs(community.id, type);

    return {
      success: true,
      data: flairs.map((f) => f.toPublicJSON()),
    };
  }

  /**
   * 플레어 생성
   */
  @Post(":slug/flairs")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "플레어 생성" })
  async createFlair(
    @Param("slug") slug: string,
    @Body() dto: CreateCommunityFlairDto,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    const flair = await this.communityService.createFlair(
      community.id,
      dto,
      userId,
    );

    return {
      success: true,
      message: "플레어가 추가되었습니다.",
      data: flair.toPublicJSON(),
    };
  }

  /**
   * 플레어 수정
   */
  @Put(":slug/flairs/:flairId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @ApiOperation({ summary: "플레어 수정" })
  async updateFlair(
    @Param("slug") slug: string,
    @Param("flairId") flairId: string,
    @Body() dto: UpdateCommunityFlairDto,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    const flair = await this.communityService.updateFlair(
      community.id,
      flairId,
      dto,
      userId,
    );

    return {
      success: true,
      message: "플레어가 수정되었습니다.",
      data: flair.toPublicJSON(),
    };
  }

  /**
   * 플레어 삭제
   */
  @Delete(":slug/flairs/:flairId")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "플레어 삭제" })
  async deleteFlair(
    @Param("slug") slug: string,
    @Param("flairId") flairId: string,
    @Request() req: { user: User; community: Community },
  ) {
    const community = req.community;
    const userId = req.user.id;

    await this.communityService.deleteFlair(community.id, flairId, userId);

    return;
  }

  // =========================================================================
  // 모더레이터 목록
  // =========================================================================

  /**
   * 모더레이터 목록 조회
   * @Public() - 글로벌 JwtAuthGuard 우회 (비로그인 사용자도 접근 가능)
   */
  @Get(":slug/moderators")
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "모더레이터 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  async getModerators(@CommunitySlug() slug: string) {
    const community = await this.communityService.findBySlug(slug);
    const mods = await this.membershipService.getModerators(community.id);

    return {
      success: true,
      data: mods.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        joinedAt: m.joinedAt,
        // user 정보 포함 (프론트엔드에서 user.username, user.profileImage 사용)
        user: m.user
          ? {
              id: m.user.id,
              username: m.user.username,
              // profileImage는 Profile 엔티티에 있음
              profileImage: m.user.profile?.profileImage || null,
              blog: m.user.blog
                ? {
                    id: m.user.blog.id,
                    slug: m.user.blog.slug,
                    alias: m.user.blog.alias,
                  }
                : null,
            }
          : null,
      })),
    };
  }

  // =========================================================================
  // 초대 링크로 가입
  // =========================================================================

  /**
   * 초대 정보 조회 (토큰)
   * @Public() - 비로그인 사용자도 초대 정보 확인 가능
   */
  @Get("invite/:token")
  @Public()
  @ApiOperation({ summary: "초대 정보 조회" })
  @ApiParam({ name: "token", description: "초대 토큰" })
  @ApiResponse({ status: 200, description: "초대 정보 반환" })
  @ApiResponse({ status: 404, description: "유효하지 않은 초대" })
  async getInviteInfo(@Param("token") token: string) {
    const invite = await this.membershipService.getInviteByToken(token);

    if (!invite) {
      return {
        success: false,
        message: "유효하지 않은 초대 링크입니다.",
      };
    }

    return {
      success: true,
      data: {
        id: invite.id,
        token: invite.token,
        isValid: invite.isValid(),
        isExpired: invite.isExpired(),
        isMaxUsesReached: invite.isMaxUsesReached(),
        expiresAt: invite.expiresAt,
        community: invite.community
          ? {
              id: invite.community.id,
              slug: invite.community.slug,
              name: invite.community.name,
              description: invite.community.description,
              iconUrl: invite.community.iconUrl,
              memberCount: invite.community.memberCount,
            }
          : null,
      },
    };
  }

  /**
   * 초대 링크로 가입
   */
  @Post("invite/:token/accept")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "초대 링크로 가입" })
  @ApiParam({ name: "token", description: "초대 토큰" })
  @ApiResponse({ status: 200, description: "가입 성공" })
  @ApiResponse({ status: 400, description: "만료된 초대 또는 사용 횟수 초과" })
  @ApiResponse({ status: 403, description: "차단된 사용자" })
  @ApiResponse({ status: 404, description: "유효하지 않은 초대" })
  @ApiResponse({ status: 409, description: "이미 가입됨" })
  async acceptInvite(@Param("token") token: string, @CurrentUser() user: User) {
    const userId = user.id;

    const membership = await this.membershipService.joinByInvite(token, userId);

    return {
      success: true,
      message: "커뮤니티에 가입되었습니다.",
      data: {
        communityId: membership.communityId,
        status: membership.status,
        role: membership.role,
      },
    };
  }
}
