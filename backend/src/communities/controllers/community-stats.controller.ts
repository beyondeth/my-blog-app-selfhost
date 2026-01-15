import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Logger,
  Req,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { Request } from "express";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { CommunityRolesGuard } from "../guards/community-roles.guard";
import { CommunityRoles } from "../decorators/community-roles.decorator";
import { CommunityRole } from "../enums";
import { CommunityStatsService } from "../services/community-stats.service";

// Request 확장 타입
interface RequestWithCommunity extends Request {
  community?: { id: string; slug: string };
}

/**
 * 커뮤니티 통계 API 컨트롤러
 *
 * **보안:**
 * - JWT 인증 필수
 * - 모더레이터 이상 역할만 접근 가능 (MODERATOR, ADMIN, OWNER)
 */
@ApiTags("Community Stats")
@Controller("communities/:slug/stats")
@UseGuards(JwtAuthGuard, CommunityRolesGuard)
@ApiBearerAuth()
export class CommunityStatsController {
  private readonly logger = new Logger(CommunityStatsController.name);

  constructor(private readonly communityStatsService: CommunityStatsService) {}

  /**
   * 커뮤니티 종합 통계 조회
   * @security MODERATOR 이상만 접근 가능
   */
  @Get()
  @CommunityRoles(
    CommunityRole.MODERATOR,
    CommunityRole.ADMIN,
    CommunityRole.OWNER,
  )
  @ApiOperation({ summary: "커뮤니티 종합 통계 조회 (모더레이터 이상)" })
  @ApiResponse({ status: 200, description: "통계 조회 성공" })
  @ApiResponse({ status: 403, description: "접근 권한 없음" })
  async getStats(@Req() req: RequestWithCommunity) {
    const communityId = req.community?.id;
    if (!communityId) {
      throw new Error("Community not found in request");
    }
    return this.communityStatsService.getAggregateStats(communityId);
  }

  /**
   * 커뮤니티 트렌드 데이터 조회
   */
  @Get("trends")
  @CommunityRoles(
    CommunityRole.MODERATOR,
    CommunityRole.ADMIN,
    CommunityRole.OWNER,
  )
  @ApiOperation({ summary: "커뮤니티 트렌드 데이터 조회" })
  async getTrends(
    @Req() req: RequestWithCommunity,
    @Query("period") period: "daily" | "weekly" | "monthly" = "daily",
    @Query("range") rangeStr: string = "7",
  ) {
    const communityId = req.community?.id;
    if (!communityId) {
      throw new Error("Community not found in request");
    }
    const range = Math.min(Math.max(parseInt(rangeStr, 10) || 7, 1), 90);
    return this.communityStatsService.getTrends(communityId, period, range);
  }

  /**
   * 인기 게시물 조회
   */
  @Get("top-posts")
  @CommunityRoles(
    CommunityRole.MODERATOR,
    CommunityRole.ADMIN,
    CommunityRole.OWNER,
  )
  @ApiOperation({ summary: "커뮤니티 인기 게시물 조회" })
  async getTopPosts(
    @Req() req: RequestWithCommunity,
    @Query("sortBy") sortBy: "hotScore" | "upvotes" | "views" = "hotScore",
    @Query("limit") limitStr: string = "5",
  ) {
    const communityId = req.community?.id;
    if (!communityId) {
      throw new Error("Community not found in request");
    }
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 5, 1), 20);
    return this.communityStatsService.getTopPosts(communityId, sortBy, limit);
  }

  /**
   * 기여자 랭킹 조회
   */
  @Get("top-contributors")
  @CommunityRoles(
    CommunityRole.MODERATOR,
    CommunityRole.ADMIN,
    CommunityRole.OWNER,
  )
  @ApiOperation({ summary: "커뮤니티 기여자 랭킹 조회" })
  async getTopContributors(
    @Req() req: RequestWithCommunity,
    @Query("limit") limitStr: string = "5",
  ) {
    const communityId = req.community?.id;
    if (!communityId) {
      throw new Error("Community not found in request");
    }
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 5, 1), 20);
    return this.communityStatsService.getTopContributors(communityId, limit);
  }
}
