import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('comments')
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 작성' })
  @ApiBearerAuth()
  create(@Body() createCommentDto: any, @Request() req) {
    return this.commentsService.create(createCommentDto, req.user);
  }

  @Get('post/:postId')
  @Public()
  @ApiOperation({ summary: '게시글별 댓글 조회' })
  findAllByPost(@Param('postId') postId: string, @CurrentUser() user?: User) {
    return this.commentsService.findAllByPost(postId, user);
  }

  @Get('all')
  @Public()
  @ApiOperation({ summary: '모든 댓글 조회 (방명록용)' })
  findAll() {
    return this.commentsService.findAllComments();
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '댓글 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.commentsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 수정' })
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updateCommentDto: any, @Request() req) {
    return this.commentsService.update(id, updateCommentDto, req.user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 삭제' })
  @ApiBearerAuth()
  remove(@Param('id') id: string, @Request() req) {
    return this.commentsService.remove(id, req.user);
  }

  @Post(':id/like')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 좋아요 토글' })
  @ApiBearerAuth()
  toggleLike(@Param('id') id: string, @Request() req) {
    return this.commentsService.toggleLike(id, req.user);
  }

  @Post(':id/dislike')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '댓글 싫어요 토글' })
  @ApiBearerAuth()
  toggleDislike(@Param('id') id: string, @Request() req) {
    return this.commentsService.toggleDislike(id, req.user);
  }
} 