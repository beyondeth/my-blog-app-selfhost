import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { BookmarksService } from './bookmarks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { BookmarksResponseDto, ToggleBookmarkResponseDto } from './dto/bookmark-response.dto';

/**
 * 북마크 컨트롤러 - 북마크 관리 API
 */
@Controller('bookmarks')
@UseGuards(JwtAuthGuard)  // 모든 엔드포인트에 인증 필요
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  /**
   * 북마크 목록 조회 (페이지네이션)
   * GET /api/v1/bookmarks?page=1&pageSize=20
   */
  @Get()
  async findAll(
    @CurrentUser() user: User,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe) pageSize: number,
  ): Promise<BookmarksResponseDto> {
    // 페이지 크기 제한 (최대 100개)
    const limitedPageSize = Math.min(pageSize, 100);
    return await this.bookmarksService.findAll(user.id, page, limitedPageSize);
  }

  /**
   * 북마크 통계 조회
   * GET /api/v1/bookmarks/stats
   * 주의: 동적 라우트보다 먼저 정의해야 함
   */
  @Get('stats')
  async getStats(@CurrentUser() user: User) {
    return await this.bookmarksService.getStats(user.id);
  }

  /**
   * 특정 포스트의 북마크 여부 확인
   * GET /api/v1/bookmarks/:postId/status
   */
  @Get(':postId/status')
  async checkStatus(
    @CurrentUser() user: User,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<{ bookmarked: boolean }> {
    const bookmarked = await this.bookmarksService.isBookmarked(user.id, postId);
    return { bookmarked };
  }

  /**
   * 북마크 토글 (추가/제거)
   * POST /api/v1/bookmarks/:postId
   */
  @Post(':postId')
  @HttpCode(HttpStatus.OK)  // 토글이므로 200 반환
  async toggle(
    @CurrentUser() user: User,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<ToggleBookmarkResponseDto> {
    return await this.bookmarksService.toggle(user.id, postId);
  }

  /**
   * 모든 북마크 삭제
   * DELETE /api/v1/bookmarks
   */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeAll(@CurrentUser() user: User): Promise<void> {
    await this.bookmarksService.removeAll(user.id);
  }

  /**
   * 북마크 삭제 (토글과 별개로 직접 삭제)
   * DELETE /api/v1/bookmarks/:postId
   */
  @Delete(':postId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: User,
    @Param('postId', ParseUUIDPipe) postId: string,
  ): Promise<void> {
    await this.bookmarksService.remove(user.id, postId);
  }
}