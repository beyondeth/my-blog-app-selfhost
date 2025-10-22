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
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { PostsService } from '../../posts/posts.service';
import { CreatePostDto } from '../../posts/dto/create-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Public } from '../../common/decorators/public.decorator';
import { UsageService } from '../../usage/usage.service';

/**
 * MCP Proxy 컨트롤러
 * MCP 서버가 API Key를 사용하여 블로그에 포스트를 생성할 수 있도록 하는 프록시 엔드포인트
 * 보안을 위해 오직 포스트 생성만 허용하며, 다른 작업은 모두 차단됨
 *
 * Rate Limit: 분당 3회, 시간당 10회, 하루 20회 (ThrottlerGuard 사용)
 * 인증: API Key (X-API-Key 헤더)
 */
@ApiTags('MCP')
@Controller('mcp')
@Public() // JWT 가드를 우회
@UseGuards(ThrottlerGuard) // Rate Limit 적용 (분당 3회, 시간당 10회, 하루 20회)
@ApiBearerAuth()
export class McpProxyController {
  private readonly logger = new Logger(McpProxyController.name);

  constructor(
    private readonly postsService: PostsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly usageService: UsageService,
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
   * API Key로 인증된 블로그에만 포스트 생성 가능
   */
  @Post('posts')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'MCP 포스트 생성 (Fast Path)',
    description: 'MCP 클라이언트가 API Key 인증을 통해 블로그에 포스트를 생성합니다. Fast Path 방식으로 즉시 응답하고 백그라운드에서 처리합니다.',
  })
  @ApiResponse({ status: 202, description: '포스트 생성 요청 접수 (백그라운드 처리 중)' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async createPost(
    @Req() req: any,
    @Body() createPostDto: CreatePostDto,
  ) {
    // API Key 정보 추출 (ApiKeyGuard에서 설정)
    const { userId, blogId } = req.apiKey;

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
      // 1. 포스트 크기 검증 (글자수 + 바이트 크기)
      if (createPostDto.content_markdown) {
        // 글자수 체크 (200,000자 제한)
        const contentLength = createPostDto.content_markdown.length;
        if (contentLength > 200000) {
          throw new BadRequestException(`포스트 내용은 최대 200,000자까지 가능합니다 (현재: ${contentLength.toLocaleString()}자)`);
        }

        // 바이트 크기 체크 (1MB 제한)
        const contentSize = Buffer.byteLength(createPostDto.content_markdown, 'utf8');
        const maxSizeMB = 1;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        if (contentSize > maxSizeBytes) {
          const sizeMB = (contentSize / (1024 * 1024)).toFixed(2);
          throw new BadRequestException(`포스트 크기는 최대 ${maxSizeMB}MB까지 가능합니다 (현재: ${sizeMB}MB)`);
        }

        this.logger.log(`[MCP Post Size Check] Length: ${contentLength.toLocaleString()} chars, Size: ${(contentSize / 1024).toFixed(2)} KB`);
      }

      // 2. MCP 포스트 제한 체크 (월간 제한 확인)
      const limitCheck = await this.usageService.checkMcpPostLimit(userId);
      if (!limitCheck.canPost) {
        this.logger.warn(`[MCP Post Limit] User ${userId} exceeded limit: ${limitCheck.reason}`);
        throw new ForbiddenException(limitCheck.reason);
      }

      // 3. User 객체 조회 (PostsService가 User를 필요로 함)
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('사용자를 찾을 수 없습니다');
      }

      // 4. 포스트 생성 (Fast Path: 150-200ms 응답, 백그라운드 처리)
      const post = await this.postsService.createFast(postData, user);

      // 5. MCP 포스트 사용량 추적 (usage_tracking 테이블에 기록)
      await this.usageService.trackMcpPost(userId);
      this.logger.log(`✅ [MCP Usage Tracked] User ${userId} - MCP post count incremented`);

      // 캐시 무효화는 posts.service.ts의 createFast()에서 이벤트 발행을 통해 처리됨
      // CacheInvalidationListener가 'post.created' 이벤트를 받아 자동으로 처리

      this.logger.log(`✅ [MCP Post Created - Fast Path] Post ID: ${post.id}, Blog: ${post.blog?.slug}, Processing: ${post._meta?.processingTime || 'N/A'}`);

      // MCP 응답 최적화: 최소 필수 정보 + Fast Path 메타데이터 반환
      return {
        id: post.id,
        slug: post.slug,
        title: post.title,
        url: `/${post.blog.slug}/${post.slug}`,  // 새 URL 구조 적용 (리다이렉트 제거)
        blog: post.blog,  // 프론트엔드 캐시 무효화를 위해 blog 정보 포함
        _meta: post._meta,  // Fast Path 메타데이터 (처리 상태, 예상 완료 시간 등)
      };
    } catch (error) {
      // 에러 로깅 (디버깅을 위해 전체 에러 출력)
      this.logger.error(`[MCP Post Creation Error] ${error.message}`, error.stack);

      // 에러 처리 - 민감한 정보는 숨기고 일반적인 메시지만 반환
      if (error.message.includes('already exists')) {
        throw new BadRequestException('이미 존재하는 슬러그입니다');
      }
      if (error.message.includes('not found')) {
        throw new BadRequestException('블로그를 찾을 수 없습니다');
      }

      // 원래 에러가 이미 HTTP Exception이면 그대로 던지기
      if (error instanceof ForbiddenException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('포스트 생성 실패');
    }
  }

}