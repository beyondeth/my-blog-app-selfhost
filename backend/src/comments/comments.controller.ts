import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
  Request,
  Query,
  Ip,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from "@nestjs/swagger";
import { CommentsService } from "./comments.service";
import { GetCommentsDto } from "./dto/get-comments-query.dto";
import { GetRepliesDto } from "./dto/get-replies.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { User } from "../users/entities/user.entity";

@ApiTags("comments")
@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "댓글 작성" })
  @ApiBearerAuth()
  create(@Body() createCommentDto: any, @Request() req, @Ip() ip: string) {
    return this.commentsService.create(createCommentDto, req.user, ip);
  }

  @Get("post/:postId")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "게시글별 댓글 조회" })
  findAllByPost(@Param("postId") postId: string, @CurrentUser() user?: User) {
    return this.commentsService.findAllByPost(postId, user);
  }

  @Get("all")
  @Public()
  @ApiOperation({ summary: "모든 댓글 조회 (방명록용)" })
  findAll() {
    return this.commentsService.findAllComments();
  }

  @Get(":id")
  @Public()
  @ApiOperation({ summary: "댓글 상세 조회" })
  findOne(@Param("id") id: string) {
    return this.commentsService.findOne(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "댓글 수정" })
  @ApiBearerAuth()
  update(
    @Param("id") id: string,
    @Body() updateCommentDto: any,
    @Request() req,
  ) {
    return this.commentsService.update(id, updateCommentDto, req.user);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "댓글 삭제" })
  @ApiBearerAuth()
  remove(@Param("id") id: string, @Request() req) {
    return this.commentsService.remove(id, req.user);
  }

  @Post(":id/like")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "댓글 좋아요 토글" })
  @ApiBearerAuth()
  toggleLike(@Param("id") id: string, @Request() req) {
    return this.commentsService.toggleLike(id, req.user);
  }

  @Post(":id/dislike")
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "댓글 싫어요 토글" })
  @ApiBearerAuth()
  toggleDislike(@Param("id") id: string, @Request() req) {
    return this.commentsService.toggleDislike(id, req.user);
  }

  // ============================================================
  // 페이지네이션 엔드포인트 (5,000명+ 커뮤니티 최적화)
  // ============================================================

  @Get("post/:postId/paginated")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "부모 댓글 페이지네이션 조회 (최신순/인기순)",
    description: `
      커서 기반 부모 댓글 페이지네이션 API
      - 최신순(recent) 또는 인기순(popular) 정렬 지원
      - 스냅샷 타임스탬프 방식으로 중복/누락 방지
      - 첫 페이지는 Redis 캐싱 (TTL 10초)

      **사용 예시:**
      1. 첫 페이지: GET /comments/post/:postId/paginated?sort=recent&limit=20
      2. 다음 페이지: GET /comments/post/:postId/paginated?sort=recent&limit=20&cursor={nextCursor}
      3. 인기순: GET /comments/post/:postId/paginated?sort=popular&limit=20&snapshotTimestamp={timestamp}
    `,
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Base64 인코딩된 커서",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "페이지당 댓글 개수 (1-50)",
    type: Number,
  })
  @ApiQuery({
    name: "sort",
    required: false,
    enum: ["recent", "popular"],
    description: "정렬 방식",
  })
  @ApiQuery({
    name: "snapshotTimestamp",
    required: false,
    description: "스냅샷 타임스탬프 (인기순 시 필수)",
  })
  getPaginatedComments(
    @Param("postId") postId: string,
    @Query() query: GetCommentsDto,
    @CurrentUser() user?: User,
  ) {
    return this.commentsService.getParentCommentsPaginated(postId, query, user);
  }

  @Get(":commentId/replies")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: "답글 페이지네이션 조회",
    description: `
      특정 부모 댓글의 답글을 페이지네이션 조회
      - 오래된 순서대로 정렬 (스레드 형태 유지)
      - 첫 페이지는 Redis 캐싱 (TTL 10초)

      **사용 예시:**
      1. 첫 페이지: GET /comments/:commentId/replies?limit=10
      2. 다음 페이지: GET /comments/:commentId/replies?limit=10&cursor={nextCursor}
    `,
  })
  @ApiQuery({
    name: "cursor",
    required: false,
    description: "Base64 인코딩된 커서",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "페이지당 답글 개수 (1-50)",
    type: Number,
  })
  getReplies(
    @Param("commentId") commentId: string,
    @Query() query: GetRepliesDto,
    @CurrentUser() user?: User,
  ) {
    return this.commentsService.getRepliesPaginated(commentId, query, user);
  }
}
