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
import { OptionalJwtAuthGuard } from "../../auth/guards/optional-jwt-auth.guard";
import { Public } from "../../common/decorators/public.decorator";
import { CommunityMembershipGuard } from "../guards/community-membership.guard";
import { CommunityRolesGuard } from "../guards/community-roles.guard";
import { CommunityVisibilityGuard } from "../guards/community-visibility.guard";
import {
  CommunitySlug,
  CommunityPostId,
} from "../decorators/community-id.decorator";
import { ModeratorOnly } from "../decorators/community-roles.decorator";
import {
  CommunityService,
  CommunityPostService,
  CommunityCommentService,
} from "../services";
import {
  CreateCommunityPostDto,
  UpdateCommunityPostDto,
  GetCommunityPostsQueryDto,
  CreateCommunityCommentDto,
  UpdateCommunityCommentDto,
} from "../dto";
import { GetCommentsDto } from "../../comments/dto/get-comments-query.dto";
import { GetRepliesDto } from "../../comments/dto/get-replies.dto";
import { VoteType } from "../../posts/enums/vote-type.enum";
import { VoteDto, VoteResponseDto } from "../../posts/dto/vote.dto";
import { RateLimit } from "../../rate-limit/rate-limit.decorator";

/**
 * 커뮤니티 게시물 컨트롤러
 *
 * @description 커뮤니티 게시물 CRUD, 좋아요, 댓글 API
 *
 * **URL 구조 (Reddit 스타일):**
 * - 메인 경로: `/api/v1/community/:slug/comments/:postId`
 * - 레거시 경로: `/api/v1/community/:slug/posts/:postId` (하위 호환성)
 *
 * **엔드포인트:**
 * - GET /posts 또는 /comments: 게시물 목록
 * - POST /posts 또는 /comments: 게시물 작성
 * - GET /posts/:postSlug 또는 /comments/:postSlug: 게시물 상세
 * - PUT /posts/:postId 또는 /comments/:postId: 게시물 수정
 * - DELETE /posts/:postId 또는 /comments/:postId: 게시물 삭제
 * - 투표/댓글 관련 하위 엔드포인트
 */
@ApiTags("Community Posts")
@Controller(["community/:slug/posts", "community/:slug/comments"])
export class CommunityPostController {
  constructor(
    private readonly communityService: CommunityService,
    private readonly postService: CommunityPostService,
    private readonly commentService: CommunityCommentService,
  ) {}

  // =========================================================================
  // 게시물 CRUD
  // =========================================================================

  /**
   * 게시물 목록 조회
   */
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "커뮤니티 게시물 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 200, description: "게시물 목록 반환" })
  async findAll(
    @CommunitySlug() slug: string,
    @Query() query: GetCommunityPostsQueryDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const community = await this.communityService.findBySlug(slug);
    const result = await this.postService.findAll(community.id, query, userId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 게시물 작성
   */
  @Post()
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "게시물 작성" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiResponse({ status: 201, description: "게시물 생성 성공" })
  @ApiResponse({ status: 403, description: "멤버가 아님" })
  async create(
    @Param("slug") slug: string,
    @Body() dto: CreateCommunityPostDto,
    @Request() req: any,
  ) {
    const community = req.community;
    const userId = req.user.id;

    const post = await this.postService.create(community.id, dto, userId);

    return {
      success: true,
      message: "게시물이 작성되었습니다.",
      data: {
        id: post.id,
        slug: post.slug,
        title: post.title,
        status: post.status,
      },
    };
  }

  /**
   * 게시물 상세 조회
   */
  @Get("id/:postId")
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "게시물 상세 조회 (ID)" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "커뮤니티 게시물 상세 정보" })
  @ApiResponse({ status: 404, description: "게시물 없음" })
  async findOneById(
    @CommunitySlug() slug: string,
    @CommunityPostId("postId") postId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const post = await this.postService.findById(slug, postId, userId);

    return {
      success: true,
      data: post,
    };
  }

  /**
   * 게시물 상세 조회
   */
  @Get(":postSlug")
  @Public()
  @UseGuards(OptionalJwtAuthGuard, CommunityVisibilityGuard)
  @ApiOperation({ summary: "게시물 상세 조회" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postSlug", description: "게시물 slug" })
  @ApiResponse({ status: 200, description: "게시물 상세 정보" })
  @ApiResponse({ status: 404, description: "게시물 없음" })
  async findOne(
    @CommunitySlug() slug: string,
    @Param("postSlug") postSlug: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const post = await this.postService.findBySlug(slug, postSlug, userId);

    return {
      success: true,
      data: post,
    };
  }

  /**
   * 게시물 수정
   */
  @Put(":postId")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "게시물 수정" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "수정 성공" })
  @ApiResponse({ status: 403, description: "권한 없음" })
  async update(
    @CommunityPostId("postId") postId: string,
    @Body() dto: UpdateCommunityPostDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const userRole = req.communityMembership?.role;

    const post = await this.postService.update(postId, dto, userId, userRole);

    return {
      success: true,
      message: "게시물이 수정되었습니다.",
      data: post,
    };
  }

  /**
   * 게시물 삭제
   */
  @Delete(":postId")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "게시물 삭제" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 204, description: "삭제 성공" })
  @ApiResponse({ status: 403, description: "권한 없음" })
  async delete(@CommunityPostId("postId") postId: string, @Request() req: any) {
    const userId = req.user.id;
    const userRole = req.communityMembership?.role;
    const isPlatformAdmin =
      String(req.user?.role || "").toLowerCase() === "admin";

    await this.postService.delete(postId, userId, userRole, isPlatformAdmin);

    return;
  }

  // =========================================================================
  // 모더레이션 액션 (스팸/승인)
  // =========================================================================

  /**
   * 게시물 스팸 표시
   */
  @Post(":postId/spam")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "게시물 스팸 표시" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "스팸 표시 완료" })
  @ApiResponse({ status: 400, description: "이미 스팸 처리됨" })
  async markAsSpam(
    @CommunityPostId("postId") postId: string,
    @Request() req: any,
  ) {
    const moderatorId = req.user.id;
    const post = await this.postService.markAsSpam(postId, moderatorId);

    return {
      success: true,
      message: "게시물이 스팸으로 표시되었습니다.",
      data: {
        id: post.id,
        slug: post.slug,
        status: post.status,
      },
    };
  }

  /**
   * 게시물 승인 (스팸/삭제 해제)
   */
  @Post(":postId/approve")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "게시물 승인 (스팸/삭제 해제)" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "승인 완료" })
  @ApiResponse({ status: 400, description: "이미 공개됨" })
  async approvePost(
    @CommunityPostId("postId") postId: string,
    @Request() req: any,
  ) {
    const moderatorId = req.user.id;
    const post = await this.postService.approvePost(postId, moderatorId);

    return {
      success: true,
      message: "게시물이 승인되었습니다.",
      data: {
        id: post.id,
        slug: post.slug,
        status: post.status,
      },
    };
  }

  /**
   * 게시물 삭제 (모더레이션용 - 삭제 사유 포함)
   */
  @Post(":postId/remove")
  @UseGuards(JwtAuthGuard, CommunityRolesGuard)
  @ModeratorOnly()
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "게시물 삭제 (모더레이션)" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 200, description: "삭제 완료" })
  @ApiResponse({ status: 400, description: "이미 삭제됨" })
  async removePost(
    @CommunityPostId("postId") postId: string,
    @Body() body: { removalReasonId?: string; removalReason?: string },
    @Request() req: any,
  ) {
    const moderatorId = req.user.id;
    const post = await this.postService.removePost(
      postId,
      moderatorId,
      body.removalReasonId,
      body.removalReason,
    );

    return {
      success: true,
      message: "게시물이 삭제되었습니다.",
      data: {
        id: post.id,
        slug: post.slug,
        status: post.status,
      },
    };
  }

  // =========================================================================
  // 투표 (Upvote/Downvote)
  // =========================================================================

  /**
   * 투표 토글 (Upvote/Downvote)
   */
  @Post(":postId/vote")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "게시물 투표 (upvote/downvote)" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 200, type: VoteResponseDto })
  async vote(
    @CommunityPostId("postId") postId: string,
    @Body() dto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResponseDto> {
    const userId = req.user.id;
    const result = await this.postService.toggleVote(postId, userId, dto.type);

    return result;
  }

  /**
   * 좋아요 토글 (레거시)
   *
   * @deprecated POST /:postId/vote 사용 권장
   */
  @Post(":postId/like")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "[Deprecated] 좋아요 토글",
    description: "POST /:postId/vote 사용 권장",
    deprecated: true,
  })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  async toggleLike(
    @CommunityPostId("postId") postId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const result = await this.postService.toggleLike(postId, userId);

    return {
      success: true,
      data: result,
    };
  }

  // =========================================================================
  // 댓글
  // =========================================================================

  /**
   * 댓글 목록 조회
   */
  @Get(":postId/comments/paginated")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "댓글 목록" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  async getComments(
    @CommunityPostId("postId") postId: string,
    @Query() query: GetCommentsDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const result = await this.commentService.getParentCommentsPaginated(
      postId,
      query,
      userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 댓글 작성
   */
  @RateLimit("community-comment-write")
  @Post(":postId/comments")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "댓글 작성" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiResponse({ status: 201, description: "댓글 생성 성공" })
  async createComment(
    @CommunityPostId("postId") postId: string,
    @Body() dto: CreateCommunityCommentDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const comment = await this.commentService.create(postId, dto, userId);

    return {
      success: true,
      message: "댓글이 작성되었습니다.",
      data: comment,
    };
  }

  /**
   * 대댓글 조회
   */
  @Get(":postId/comments/:commentId/replies")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "대댓글 목록" })
  async getReplies(
    @Param("commentId") commentId: string,
    @Query() query: GetRepliesDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const result = await this.commentService.getRepliesPaginated(
      commentId,
      query,
      userId,
    );

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 댓글 좋아요 토글
   */
  @RateLimit("community-comment-react")
  @Post(":postId/comments/:commentId/like")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "댓글 좋아요 토글" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiParam({ name: "commentId", description: "댓글 ID" })
  async toggleCommentLike(
    @Param("commentId") commentId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const result = await this.commentService.toggleLike(commentId, userId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 댓글 싫어요 토글
   */
  @RateLimit("community-comment-react")
  @Post(":postId/comments/:commentId/dislike")
  @UseGuards(JwtAuthGuard, CommunityMembershipGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "댓글 싫어요 토글" })
  @ApiParam({ name: "slug", description: "커뮤니티 slug" })
  @ApiParam({ name: "postId", description: "게시물 ID" })
  @ApiParam({ name: "commentId", description: "댓글 ID" })
  async toggleCommentDislike(
    @Param("commentId") commentId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const result = await this.commentService.toggleDislike(commentId, userId);

    return {
      success: true,
      data: result,
    };
  }

  /**
   * 댓글 수정
   */
  @RateLimit("community-comment-manage")
  @Put(":postId/comments/:commentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "댓글 수정" })
  async updateComment(
    @Param("commentId") commentId: string,
    @Body() dto: UpdateCommunityCommentDto,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const comment = await this.commentService.update(commentId, dto, userId);

    return {
      success: true,
      message: "댓글이 수정되었습니다.",
      data: comment,
    };
  }

  /**
   * 댓글 삭제
   */
  @RateLimit("community-comment-manage")
  @Delete(":postId/comments/:commentId")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "댓글 삭제" })
  async deleteComment(
    @Param("commentId") commentId: string,
    @Request() req: any,
  ) {
    const userId = req.user.id;
    const userRole = req.communityMembership?.role;

    await this.commentService.delete(commentId, userId, userRole);

    return;
  }
}
