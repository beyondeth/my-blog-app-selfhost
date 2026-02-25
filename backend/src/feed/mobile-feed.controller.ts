import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import {
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiTags,
} from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { FeedService } from "./feed.service";
import { Public } from "../common/decorators/public.decorator";
import { GetUnifiedFeedDto, UnifiedFeedResponseDto } from "./dto";

@ApiTags("mobile-feed")
@Controller("mobile/feed")
export class MobileFeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "모바일 통합 피드 조회",
    description:
      "모바일 앱용 통합 피드 조회 API. 웹 /feed의 응답을 모바일에서 그대로 사용할 수 있는 형태로 제공합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "모바일 통합 피드 조회 성공",
    type: UnifiedFeedResponseDto,
  })
  async getMobileFeed(
    @Query() dto: GetUnifiedFeedDto,
    @Request() req: any,
  ): Promise<UnifiedFeedResponseDto> {
    const userId = req.user?.id;
    return this.feedService.getUnifiedFeed(dto, userId);
  }
}
