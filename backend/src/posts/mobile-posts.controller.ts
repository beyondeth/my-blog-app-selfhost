import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  ForbiddenException,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from "@nestjs/swagger";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { PostsService } from "./posts.service";
import { CreatePostDto } from "./dto/create-post.dto";
import { VoteDto, VoteResponseDto } from "./dto/vote.dto";
import { VoteService } from "./services/vote.service";
import { ViewerIdUtil } from "../common/utils/viewer-id.util";
import { ViewCountService } from "./view-count.service";

@ApiTags("mobile-posts")
@Controller("mobile/posts")
export class MobilePostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly voteService: VoteService,
    private readonly viewCountService: ViewCountService,
  ) {}

  @Get(":id")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "모바일 글 상세 조회 (기존 글 조회 래퍼)" })
  @ApiResponse({ status: 200, description: "글 상세 조회 성공" })
  async findOne(@Param("id", ParseUUIDPipe) id: string, @Request() req: any) {
    const user = req.user || null;
    return this.postsService.findOne(id, user);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "모바일 글 작성" })
  @ApiResponse({ status: 201, description: "글 작성 성공" })
  async create(@Body() createPostDto: CreatePostDto, @Request() req: any) {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException("로그인이 필요합니다.");
    }

    return this.postsService.create(createPostDto, user);
  }

  @Post(":id/vote")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "모바일 글 투표" })
  @ApiResponse({ status: 200, type: VoteResponseDto })
  async vote(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: VoteDto,
    @Request() req: any,
  ): Promise<VoteResponseDto> {
    const user = req.user;
    if (!user) {
      throw new ForbiddenException("로그인이 필요합니다.");
    }

    return this.voteService.toggleVote(id, user.id, dto.type);
  }

  @Post(":id/view")
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: "모바일 조회수 증가" })
  @ApiResponse({ status: 200, description: "조회수 증가 등록 성공" })
  async incrementViewCount(
    @Param("id", ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const viewerId = ViewerIdUtil.resolve(req);

    await this.viewCountService.incrementViewCount(id, userId, viewerId);
    return { message: "View count queued for batch update" };
  }
}
