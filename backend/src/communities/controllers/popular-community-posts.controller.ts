import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { PopularPostsReadService } from "../../popular-posts/services/popular-posts-read.service";

@ApiTags("Community")
@Controller("communities")
export class PopularCommunityPostsController {
  constructor(private readonly popularPostsReadService: PopularPostsReadService) {}

  @Get("popular/:period")
  @Public()
  @ApiOperation({ summary: "커뮤니티 인기 게시글 조회 (기간별)" })
  @ApiQuery({
    name: "limit",
    required: false,
    type: Number,
    description: "조회할 개수 (기본: 5, 최대: 20)",
  })
  async getPopularPosts(
    @Param("period") period: string,
    @Query("limit") limit?: string,
  ) {
    return this.popularPostsReadService.getCommunityPopularPosts(period, limit);
  }
}
