import {
  Controller,
  Post,
  Delete,
  Get,
  Param,
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  Req
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { FollowsService } from './follows.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { FollowInfoDto, PaginationQueryDto, PaginatedResponseDto } from './dto';
import { User } from '../users/entities/user.entity';
import { Throttle } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { plainToInstance } from 'class-transformer';
import { UserResponseDto } from '../users/dto/user-response.dto';

@ApiTags('follows')
@Controller('users')
@UseInterceptors(ClassSerializerInterceptor)
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Post(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 팔로우' })
  @ApiResponse({ status: 204, description: '팔로우 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 (자기 자신 팔로우, 이미 팔로우 중)' })
  @ApiResponse({ status: 404, description: '사용자를 찾을 수 없음' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 분당 10회 제한
  async follow(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: ExpressRequest & { user: { id: string } },
  ): Promise<void> {
    console.log(`[FollowController] Follow request - targetUserId: ${userId}, currentUserId: ${req.user.id}`);
    await this.followsService.follow(req.user.id, userId);
  }

  @Delete(':userId/follow')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자 언팔로우' })
  @ApiResponse({ status: 204, description: '언팔로우 성공' })
  @ApiResponse({ status: 404, description: '팔로우 관계를 찾을 수 없음' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 분당 10회 제한
  async unfollow(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: ExpressRequest & { user: { id: string } },
  ): Promise<void> {
    console.log(`[FollowController] Unfollow request - targetUserId: ${userId}, currentUserId: ${req.user.id}`);
    await this.followsService.unfollow(req.user.id, userId);
  }

  @Get(':userId/followers')
  @Public()
  @ApiOperation({ summary: '팔로워 목록 조회' })
  @ApiResponse({ status: 200, description: '팔로워 목록 반환' })
  async getFollowers(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const result = await this.followsService.getFollowers(userId, query.page, query.limit);

    // DTO 변환: User 엔티티 → UserResponseDto (민감정보 제외)
    return {
      ...result,
      data: result.data.map(user =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        })
      ),
    };
  }

  @Get(':userId/following')
  @Public()
  @ApiOperation({ summary: '팔로잉 목록 조회' })
  @ApiResponse({ status: 200, description: '팔로잉 목록 반환' })
  async getFollowing(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const result = await this.followsService.getFollowing(userId, query.page, query.limit);

    // DTO 변환: User 엔티티 → UserResponseDto (민감정보 제외)
    return {
      ...result,
      data: result.data.map(user =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        })
      ),
    };
  }

  @Get(':userId/follow-info')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '팔로우 정보 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '팔로우 정보 반환',
    type: FollowInfoDto,
  })
  async getFollowInfo(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Req() req: ExpressRequest & { user?: { id: string } },
  ): Promise<FollowInfoDto> {
    const currentUserId = req.user?.id;
    console.log(`[FollowController] follow-info request - userId: ${userId}, currentUserId: ${currentUserId || 'not authenticated'}`);
    const hasCookies = req.headers?.cookie ? 'Has cookies' : 'No cookies';
    console.log('[FollowController] Request headers:', hasCookies);
    console.log('[FollowController] User object:', req.user ? `User ID: ${req.user.id}` : 'No user object');
    return this.followsService.getFollowInfo(userId, currentUserId);
  }
}