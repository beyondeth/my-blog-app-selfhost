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
  Req,
  Logger,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { FollowsService } from "./follows.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../common/guards/optional-jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import {
  FollowInfoDto,
  PaginationQueryDto,
  PaginatedResponseDto,
  CursorPaginationQueryDto,
  CursorPaginatedResponseDto,
} from "./dto";
import { User } from "../users/entities/user.entity";
import { Throttle } from "@nestjs/throttler";
import { Request as ExpressRequest } from "express";
import { plainToInstance } from "class-transformer";
import { UserResponseDto } from "../users/dto/user-response.dto";

@ApiTags("follows")
@Controller("users")
@UseInterceptors(ClassSerializerInterceptor)
export class FollowsController {
  private readonly logger = new Logger(FollowsController.name);

  constructor(private readonly followsService: FollowsService) {}

  @Post(":userId/follow")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "사용자 팔로우" })
  @ApiResponse({ status: 204, description: "팔로우 성공" })
  @ApiResponse({
    status: 400,
    description: "잘못된 요청 (자기 자신 팔로우, 이미 팔로우 중)",
  })
  @ApiResponse({ status: 404, description: "사용자를 찾을 수 없음" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 분당 10회 제한
  async follow(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: ExpressRequest & { user: { id: string } },
  ): Promise<void> {
    this.logger.debug(
      `Follow request: target=${this.maskId(userId)}, actor=${this.maskId(req.user.id)}`,
    );
    await this.followsService.follow(req.user.id, userId);
  }

  @Delete(":userId/follow")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "사용자 언팔로우" })
  @ApiResponse({ status: 204, description: "언팔로우 성공" })
  @ApiResponse({ status: 404, description: "팔로우 관계를 찾을 수 없음" })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 분당 10회 제한
  async unfollow(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: ExpressRequest & { user: { id: string } },
  ): Promise<void> {
    this.logger.debug(
      `Unfollow request: target=${this.maskId(userId)}, actor=${this.maskId(req.user.id)}`,
    );
    await this.followsService.unfollow(req.user.id, userId);
  }

  @Get(":userId/followers")
  @Public()
  @ApiOperation({ summary: "팔로워 목록 조회" })
  @ApiResponse({ status: 200, description: "팔로워 목록 반환" })
  async getFollowers(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const result = await this.followsService.getFollowers(
      userId,
      query.page,
      query.limit,
    );

    // DTO 변환: User 엔티티 → UserResponseDto (민감정보 제외)
    return {
      ...result,
      data: result.data.map((user) =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
    };
  }

  @Get(":userId/following")
  @Public()
  @ApiOperation({ summary: "팔로잉 목록 조회" })
  @ApiResponse({ status: 200, description: "팔로잉 목록 반환" })
  async getFollowing(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    const result = await this.followsService.getFollowing(
      userId,
      query.page,
      query.limit,
    );

    // DTO 변환: User 엔티티 → UserResponseDto (민감정보 제외)
    return {
      ...result,
      data: result.data.map((user) =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
    };
  }

  @Get(":userId/follow-info")
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "팔로우 정보 조회" })
  @ApiResponse({
    status: 200,
    description: "팔로우 정보 반환",
    type: FollowInfoDto,
  })
  async getFollowInfo(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: ExpressRequest & { user?: { id: string } },
  ): Promise<FollowInfoDto> {
    const currentUserId = req.user?.id;
    this.logger.debug(
      `Follow-info request: target=${this.maskId(userId)}, actor=${currentUserId ? this.maskId(currentUserId) : "anonymous"}`,
    );
    return this.followsService.getFollowInfo(userId, currentUserId);
  }

  private maskId(value?: string): string {
    if (!value) return "none";
    if (value.length <= 8) return value;
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  }

  @Get(":userId/followers/cursor")
  @Public()
  @ApiOperation({ summary: "팔로워 목록 조회 (커서 기반)" })
  @ApiResponse({ status: 200, description: "팔로워 목록 반환 (커서 기반)" })
  async getFollowersCursor(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: CursorPaginationQueryDto,
  ): Promise<CursorPaginatedResponseDto<UserResponseDto>> {
    const result = await this.followsService.getFollowersCursor(userId, {
      limit: query.limit,
      cursor: query.cursor,
      cursorId: query.cursorId,
    });

    return {
      ...result,
      data: result.data.map((user) =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
    };
  }

  @Get(":userId/following/cursor")
  @Public()
  @ApiOperation({ summary: "팔로잉 목록 조회 (커서 기반)" })
  @ApiResponse({ status: 200, description: "팔로잉 목록 반환 (커서 기반)" })
  async getFollowingCursor(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: CursorPaginationQueryDto,
  ): Promise<CursorPaginatedResponseDto<UserResponseDto>> {
    const result = await this.followsService.getFollowingCursor(userId, {
      limit: query.limit,
      cursor: query.cursor,
      cursorId: query.cursorId,
    });

    return {
      ...result,
      data: result.data.map((user) =>
        plainToInstance(UserResponseDto, user, {
          excludeExtraneousValues: true,
        }),
      ),
    };
  }
}
