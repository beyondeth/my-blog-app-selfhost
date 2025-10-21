import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { BlocksService } from './blocks.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

/**
 * 사용자 차단 컨트롤러
 * 차단 관련 API 엔드포인트 제공
 */
@Controller('blocks')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  /**
   * 사용자 차단
   * POST /blocks
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async blockUser(@Body() createBlockDto: CreateBlockDto, @Request() req) {
    const blockerId = req.user.id;
    return await this.blocksService.blockUser(blockerId, createBlockDto);
  }

  /**
   * 사용자 차단 해제
   * DELETE /blocks/:userId
   */
  @Delete(':userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unblockUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    const blockerId = req.user.id;
    await this.blocksService.unblockUser(blockerId, userId);
  }

  /**
   * 내가 차단한 사용자 목록 조회
   * GET /blocks/my-blocks
   */
  @Get('my-blocks')
  async getMyBlocks(
    @Request() req,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page?: number,
    @Query(
      'limit',
      new DefaultValuePipe(parseInt(process.env.DEFAULT_PAGE_LIMIT || '20')),
      ParseIntPipe,
    )
    limit?: number,
  ) {
    const blockerId = req.user.id;
    return await this.blocksService.getMyBlocks(blockerId, page, limit);
  }

  /**
   * 특정 사용자 차단 여부 확인
   * GET /blocks/check/:userId
   */
  @Get('check/:userId')
  async checkBlock(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    const blockerId = req.user.id;
    const isBlocked = await this.blocksService.isBlocked(blockerId, userId);
    return {
      isBlocked,
      blockerId,
      blockedId: userId,
    };
  }

  /**
   * 양방향 차단 여부 확인 (서로 차단했는지)
   * GET /blocks/check-mutual/:userId
   */
  @Get('check-mutual/:userId')
  async checkMutualBlock(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Request() req,
  ) {
    const currentUserId = req.user.id;
    return await this.blocksService.checkMutualBlock(currentUserId, userId);
  }
}
