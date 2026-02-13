import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Ip,
  BadRequestException,
  ParseUUIDPipe,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { CommentsService } from "./comments.service";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("mobile-comments")
@Controller("mobile/posts")
export class MobileCommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(":postId/comments")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "모바일 댓글 목록 조회" })
  @ApiResponse({ status: 200, description: "댓글 목록 반환" })
  async findAllByPost(
    @Param("postId", ParseUUIDPipe) postId: string,
    @Request() req: any,
  ) {
    const user = req.user || null;
    return this.commentsService.findAllByPost(postId, user);
  }

  @Post(":postId/comments")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "모바일 댓글 작성" })
  @ApiResponse({ status: 200, description: "댓글 작성 성공" })
  async create(
    @Param("postId", ParseUUIDPipe) postId: string,
    @Body() body: { content?: string; parentCommentId?: string },
    @Request() req: any,
    @Ip() ip: string,
  ) {
    const user = req.user;
    if (!user) {
      throw new BadRequestException("로그인이 필요합니다.");
    }

    const content = body?.content?.trim();
    if (!content) {
      throw new BadRequestException("content는 필수입니다.");
    }

    return this.commentsService.create(
      {
        postId,
        content,
        parentCommentId: body?.parentCommentId,
      },
      user,
      ip,
    );
  }
}
