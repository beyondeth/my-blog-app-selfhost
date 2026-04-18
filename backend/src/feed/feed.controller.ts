import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { FeedService } from "./feed.service";
import { GetUnifiedFeedDto, UnifiedFeedResponseDto } from "./dto";
import { Public } from "../common/decorators/public.decorator";
import { KnowledgePublicReadService } from "../knowledge/services/knowledge-public-read.service";

/**
 * 통합 피드 컨트롤러
 *
 * @description 홈피드에서 블로그 포스트와 커뮤니티 포스트를 통합 제공
 *
 * **엔드포인트:**
 * - GET /feed - 통합 피드 조회
 *
 * **특징:**
 * - 인증 선택적 (로그인 시 좋아요 여부 등 추가 정보)
 * - 커서 기반 페이지네이션
 * - 필터링 (전체/블로그/커뮤니티)
 * - 정렬 (최신순/인기순)
 */
@ApiTags("Feed")
@Controller("feed")
export class FeedController {
  constructor(
    private readonly feedService: FeedService,
    private readonly knowledgePublicReadService: KnowledgePublicReadService,
  ) {}

  /**
   * 통합 피드 조회
   *
   * @description 블로그 포스트와 커뮤니티 포스트를 통합하여 반환
   *
   * @example
   * GET /api/v1/feed
   * GET /api/v1/feed?filter=blog&sort=recent&limit=20
   * GET /api/v1/feed?cursor=eyJjcmVhdGVkQXQiOi4uLn0=
   */
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "통합 피드 조회",
    description:
      "블로그 포스트와 커뮤니티 포스트를 통합하여 시간순/인기순으로 조회합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "피드 조회 성공",
    type: UnifiedFeedResponseDto,
  })
  async getUnifiedFeed(
    @Query() dto: GetUnifiedFeedDto,
    @Request() req: any,
  ): Promise<UnifiedFeedResponseDto> {
    // 로그인된 사용자 ID (선택적)
    const userId = req.user?.id;

    return this.feedService.getUnifiedFeed(dto, userId);
  }

  @Get("knowledge/trending")
  @Public()
  @ApiOperation({
    summary: "홈피드용 공개 Knowledge 트렌딩 노드 조회",
  })
  async getTrendingKnowledgeNodes(
    @Query("limit") limit?: string,
  ) {
    const safeLimit = Number.isFinite(Number(limit)) ? Number(limit) : 5;
    return this.knowledgePublicReadService.getTrendingNodes(safeLimit);
  }
}
