import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";
import { BlogsService } from "./blogs.service";
import { BlogStatsService } from "../common/services/blog-stats.service";

/**
 * 블로그 통계 API 컨트롤러
 *
 * **보안:**
 * - 모든 엔드포인트는 JWT 인증 필수
 * - 블로그 소유자만 자신의 통계에 접근 가능
 */
@ApiTags("Blog Stats")
@Controller("blogs")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlogStatsController {
  private readonly logger = new Logger(BlogStatsController.name);

  constructor(
    private readonly blogsService: BlogsService,
    private readonly blogStatsService: BlogStatsService,
  ) {}

  /**
   * 블로그 종합 통계 조회
   * @security 블로그 소유자만 접근 가능
   */
  @Get(":blogIdOrSlug/stats")
  @ApiOperation({ summary: "블로그 종합 통계 조회 (소유자만)" })
  @ApiResponse({ status: 200, description: "통계 조회 성공" })
  @ApiResponse({ status: 403, description: "접근 권한 없음" })
  @ApiResponse({ status: 404, description: "블로그를 찾을 수 없음" })
  async getStats(
    @Param("blogIdOrSlug") blogIdOrSlug: string,
    @CurrentUser() user: User,
  ) {
    const blog = await this.resolveBlogWithOwnerCheck(blogIdOrSlug, user);
    return this.blogStatsService.getAggregateStats(blog.id);
  }

  /**
   * 블로그 트렌드 데이터 조회
   * @security 블로그 소유자만 접근 가능
   */
  @Get(":blogIdOrSlug/stats/trends")
  @ApiOperation({ summary: "블로그 트렌드 데이터 조회 (소유자만)" })
  @ApiResponse({ status: 200, description: "트렌드 조회 성공" })
  async getTrends(
    @Param("blogIdOrSlug") blogIdOrSlug: string,
    @Query("period") period: "daily" | "weekly" | "monthly" = "daily",
    @Query("range") rangeStr: string = "7",
    @CurrentUser() user: User,
  ) {
    const blog = await this.resolveBlogWithOwnerCheck(blogIdOrSlug, user);
    const range = Math.min(Math.max(parseInt(rangeStr, 10) || 7, 1), 90);
    return this.blogStatsService.getTrends(blog.id, period, range);
  }

  /**
   * 블로그 인기 게시물 조회
   * @security 블로그 소유자만 접근 가능
   */
  @Get(":blogIdOrSlug/stats/top-posts")
  @ApiOperation({ summary: "블로그 인기 게시물 조회 (소유자만)" })
  @ApiResponse({ status: 200, description: "인기 게시물 조회 성공" })
  async getTopPosts(
    @Param("blogIdOrSlug") blogIdOrSlug: string,
    @Query("sortBy") sortBy: "views" | "likes" | "comments" = "views",
    @Query("limit") limitStr: string = "5",
    @CurrentUser() user: User,
  ) {
    const blog = await this.resolveBlogWithOwnerCheck(blogIdOrSlug, user);
    const limit = Math.min(Math.max(parseInt(limitStr, 10) || 5, 1), 20);
    return this.blogStatsService.getTopPosts(blog.id, sortBy, limit);
  }

  /**
   * 블로그 조회 및 소유자 권한 확인
   * @private
   */
  private async resolveBlogWithOwnerCheck(
    blogIdOrSlug: string,
    user: User,
  ): Promise<{ id: string; userId: string }> {
    // UUID 형식 체크
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        blogIdOrSlug,
      );

    let blog: { id: string; userId: string } | null = null;

    if (isUuid) {
      blog = await this.blogsService.findByIdMinimal(blogIdOrSlug);
    } else {
      // slug 또는 alias로 조회
      blog = await this.blogsService.findBySlugOrAliasMinimal(blogIdOrSlug);
    }

    if (!blog) {
      throw new NotFoundException("블로그를 찾을 수 없습니다");
    }

    // 소유자 확인
    if (blog.userId !== user.id) {
      this.logger.warn(
        `Unauthorized stats access attempt: user ${user.id} tried to access blog ${blog.id}`,
      );
      throw new ForbiddenException(
        "본인의 블로그 통계만 조회할 수 있습니다",
      );
    }

    return blog;
  }
}
