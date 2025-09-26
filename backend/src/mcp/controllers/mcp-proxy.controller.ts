import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { OAuthGuard } from '../../oauth/guards/oauth.guard';
import { RequireScopes } from '../../oauth/decorators/scopes.decorator';
import { PostsService } from '../../posts/posts.service';
import { CreatePostDto } from '../../posts/dto/create-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Public } from '../../common/decorators/public.decorator';

/**
 * MCP Proxy 컨트롤러
 * MCP 서버가 OAuth2 토큰을 사용하여 블로그에 포스트를 생성할 수 있도록 하는 프록시 엔드포인트
 * 보안을 위해 오직 포스트 생성만 허용하며, 다른 작업은 모두 차단됨
 */
@ApiTags('MCP')
@Controller('mcp')
@Public() // JWT 가드를 우회
@ApiBearerAuth()
export class McpProxyController {
  constructor(
    private readonly postsService: PostsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * MCP 헬스체크 엔드포인트
   * 연결 상태 확인용
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'MCP 헬스체크',
    description: 'MCP 서버와의 연결 상태를 확인합니다.',
  })
  @ApiResponse({ status: 200, description: '정상 작동 중' })
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'MCP 서버가 정상 작동 중입니다.'
    };
  }

  /**
   * MCP를 통한 포스트 생성
   * OAuth2 토큰에 바인딩된 블로그에만 포스트 생성 가능
   */
  @Post('posts')
  @UseGuards(OAuthGuard)
  @RequireScopes('mcp:post:create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'MCP 포스트 생성',
    description: 'MCP 클라이언트가 OAuth2 인증을 통해 블로그에 포스트를 생성합니다. 토큰에 바인딩된 블로그에만 작성 가능합니다.',
  })
  @ApiResponse({ status: 201, description: '포스트 생성 성공' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async createPost(
    @Req() req: any,
    @Body() createPostDto: CreatePostDto,
  ) {
    // OAuth 정보 추출 (OAuthGuard에서 설정)
    const { userId, blogId, scopes } = req.oauth;

    // 스코프 재확인 (중복 확인이지만 보안상 중요)
    if (!scopes.includes('mcp:post:create')) {
      throw new ForbiddenException('포스트 생성 권한이 없습니다');
    }

    // MCP에서 오는 content_markdown은 원본 마크다운 (base64 인코딩 없음)
    // PostsService.create는 user를 통해 blogId를 자동으로 찾으므로
    // 여기서는 CreatePostDto의 필드만 전달하면 됨
    const postData: CreatePostDto = {
      title: createPostDto.title,
      content_markdown: createPostDto.content_markdown,  // 원본 마크다운 콘텐츠 그대로 전달
      tags: createPostDto.tags,
      category: createPostDto.category,
      qualityScore: createPostDto.qualityScore, // AI 품질 점수
    };

    try {
      // User 객체 조회 (PostsService가 User를 필요로 함)
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다');
      }

      // 포스트 생성 (서비스 레이어에서 추가 검증)
      const post = await this.postsService.create(postData, user);

      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        isPublished: post.isPublished,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        url: `/blog/${post.blog.slug}/posts/${post.slug}`,
      };
    } catch (error) {
      // 에러 처리 - 민감한 정보는 숨기고 일반적인 메시지만 반환
      if (error.message.includes('already exists')) {
        throw new BadRequestException('이미 존재하는 슬러그입니다');
      }
      if (error.message.includes('not found')) {
        throw new BadRequestException('블로그를 찾을 수 없습니다');
      }
      throw new BadRequestException('포스트 생성 실패');
    }
  }

}