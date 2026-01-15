import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { OpenGraphService } from "./opengraph.service";
import { OpenGraphResponseDto } from "./dto/opengraph.dto";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";

/**
 * Open Graph 컨트롤러
 *
 * @description
 * URL에서 Open Graph 메타데이터를 추출하는 API입니다.
 * 링크 카드 미리보기에 사용됩니다.
 */
@ApiTags("opengraph")
@Controller("opengraph")
export class OpenGraphController {
  constructor(private readonly openGraphService: OpenGraphService) {}

  /**
   * URL에서 Open Graph 메타데이터 조회
   *
   * @description
   * 주어진 URL에서 Open Graph 메타데이터를 추출합니다.
   * 결과는 24시간 동안 캐시됩니다.
   *
   * @param url 메타데이터를 추출할 URL
   * @returns Open Graph 메타데이터
   *
   * @example
   * GET /api/v1/opengraph?url=https://github.com/user/repo
   */
  @Get()
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "URL에서 Open Graph 메타데이터 조회" })
  @ApiQuery({
    name: "url",
    required: true,
    description: "메타데이터를 추출할 URL",
    example: "https://github.com/user/repo",
  })
  @ApiResponse({
    status: 200,
    description: "Open Graph 메타데이터",
    type: OpenGraphResponseDto,
  })
  async fetchOpenGraph(
    @Query("url") url: string,
  ): Promise<OpenGraphResponseDto> {
    return this.openGraphService.fetchOpenGraph(url);
  }
}
