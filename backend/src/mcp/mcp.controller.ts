import { Controller, Post, Body, UseGuards, UseInterceptors, Request, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { Public } from '../common/decorators/public.decorator';
import { OAuthGuard } from '../oauth/guards/oauth.guard';
import { RequireScopes } from '../oauth/decorators/scopes.decorator';
import { McpRateLimitGuard } from './mcp-rate-limit.guard';
import { McpLoggingInterceptor } from './mcp-logging.interceptor';
import { PostsService } from '../posts/posts.service';
import { CacheService } from '../cache/cache.service';
import { UnifiedRedisService } from '../redis/unified-redis.service';
import { UsageService } from '../usage/usage.service';

@Controller('mcp')
@Public() // Bypass JWT auth, we'll use API key auth instead
@UseInterceptors(McpLoggingInterceptor) // Log all MCP requests
@UseGuards(McpRateLimitGuard) // Apply rate limiting to all endpoints
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly cacheService: CacheService,
    private readonly redisService: UnifiedRedisService,
    private readonly usageService: UsageService,
  ) {}

  /**
   * 캐시 키 생성 헬퍼 메서드 (posts.controller.ts와 동일)
   */
  private generateCacheKey(params: {
    page: number;
    limit: number;
    blogSlug?: string;
    isPublished?: boolean;
    isPublicOnly?: boolean;
  }): string {
    const { page, limit, blogSlug, isPublished, isPublicOnly = true } = params;
    let key = `feed:public:page:${page}:limit:${limit}`;

    if (blogSlug) {
      key += `:blog:${blogSlug}`;
    }

    if (isPublished !== undefined) {
      key += `:published:${isPublished}`;
    }

    return key;
  }




  /**
   * 포스트 생성 (자동 포스팅 전용)
   * MCP는 오직 포스트 생성만 가능 - 조회/수정/삭제 불가
   *
   * OAuth2 토큰으로만 인증 가능
   */
  @Post('posts')
  @UseGuards(OAuthGuard)
  @RequireScopes('mcp:post:create')
  async createPost(@Body() createPostDto: CreatePostDto, @Headers() headers, @Request() req) {
    const startTime = Date.now();

    // OAuth 정보 추출 (OAuthGuard에서 설정)
    const { userId, blogId, user, blog } = req.oauth;

    // Debug logging
    if (!userId || !blogId || !user || !blog) {
      this.logger.error('Missing required data from OAuthGuard', {
        hasUserId: !!userId,
        hasBlogId: !!blogId,
        hasUser: !!user,
        hasBlog: !!blog,
      });
      throw new UnauthorizedException('OAuth authentication data missing');
    }

    // MCP 자동포스팅 사용량 체크 및 추적
    // 일일 및 월간 제한을 초과하면 ForbiddenException 발생
    await this.usageService.trackMcpPost(userId);

    // Extract AI type from tags
    const aiTag = createPostDto.tags?.find(tag => tag.startsWith('ai:'));
    const clientType = aiTag ? aiTag.replace('ai:', '') : 'unknown';

    // Log warning if AI tag is missing
    if (!aiTag) {
      this.logger.warn(`Post created without AI identification tag by user: ${user.email}`);
    } else {
      this.logger.log(`Post created by ${clientType} AI for user: ${user.email}`);
    }

    // Create the post using the standard posts service for consistency
    // This ensures MCP posts follow the same logic as regular posts
    const createdPost = await this.postsService.create(createPostDto, user);

    // 캐시 무효화 및 재생성 (posts.controller.ts와 동일한 로직)
    try {
      // 1. 메인 피드 1페이지만 무효화 (새 포스트는 항상 최상단에 추가됨)
      await this.cacheService.delete('feed:main:p1');
      this.logger.log('✅ Cache invalidated: page 1 only after MCP post creation');

      // 2. 캐시 워밍: 1페이지 데이터를 미리 로드하여 캐시 생성
      const pageNumber = 1;
      const limitNumber = 20;
      const cacheKey = this.generateCacheKey({
        page: pageNumber,
        limit: limitNumber,
        isPublicOnly: true
      });

      // 새 데이터 조회 (캐시용 - liked 필드 제외, 공개 블로그만)
      const freshData = await this.postsService.findAll(
        pageNumber,
        limitNumber,
        null,
        null,
        null,  // user를 null로 - liked 필드 제외
        undefined,
        true   // isForCache: true - 공개 블로그만
      );

      // 캐시에 저장 (TTL: 10분으로 연장 - posts.controller.ts와 동일)
      await this.cacheService.set('feed:main:p1', freshData, 600);
      this.logger.log('🔥 Cache warmed: First page pre-cached with new MCP post');
    } catch (error) {
      this.logger.error(`❌ Failed to invalidate/warm first page cache after MCP post: ${error.message}`);
      // 캐시 무효화 실패해도 포스트 생성은 성공
    }

    // MCP 트래킹 제거됨 - 나중에 재구현 예정
    // TODO: MCP tracking을 다시 구현할 때 OAuth2 기반으로 추가

    return createdPost;
  }

  /**
   * MCP 세션 검증 엔드포인트
   * MCP 세션이 웹 로그인 세션과 동기화되어 있는지 확인
   *
   * POST /mcp/validate-session
   */
  @Post('validate-session')
  async validateSession(
    @Body() body: { sessionId: string; userId?: number },
    @Headers('x-mcp-internal') internalHeader: string,
  ) {
    // 내부 호출인지 확인 (Proxy Server에서만 호출 가능)
    if (internalHeader !== 'true') {
      throw new UnauthorizedException('이 엔드포인트는 내부 호출용입니다.');
    }

    const { sessionId, userId } = body;

    if (!sessionId) {
      return {
        valid: false,
        message: '세션 ID가 필요합니다.',
      };
    }

    try {
      // MCP 세션 정보를 Redis에서 조회
      // mcp:sessions:{sessionId} 형식으로 저장
      const mcpSessionKey = `mcp:sessions:${sessionId}`;
      const sessionData = await this.redisService.getCache<any>('mcp', `sessions:${sessionId}`);

      if (!sessionData) {
        this.logger.debug(`MCP 세션이 Redis에 없음: ${sessionId.substring(0, 8)}...`);
        return {
          valid: false,
          message: 'MCP 세션이 없습니다.',
        };
      }

      // userId가 제공되었으면 매칭 확인
      if (userId && sessionData.userId !== userId) {
        this.logger.debug(`MCP 세션의 사용자 ID 불일치: 세션=${sessionData.userId}, 요청=${userId}`);
        return {
          valid: false,
          message: '세션이 다른 사용자와 연결되어 있습니다.',
        };
      }

      // 웹 세션 확인 (access_token이나 refresh_token 쿠키와 연동된 세션)
      // 여기서는 MCP 세션이 웹 로그인 상태와 연동되어 있는지 확인
      const webSessionKey = `sessions:user:${sessionData.userId}`;
      const webSession = await this.redisService.getCache<any>('sessions', `user:${sessionData.userId}`);

      if (!webSession || !webSession.isActive) {
        this.logger.debug(`웹 세션이 없거나 비활성: userId=${sessionData.userId}`);
        // 웹에서 로그아웃했으면 MCP 세션도 무효화
        await this.redisService.deleteCache('mcp', `sessions:${sessionId}`);
        return {
          valid: false,
          message: '웹 로그아웃으로 MCP 세션이 무효화되었습니다.',
        };
      }

      // 세션 유효 시간 체크 (24시간)
      const sessionAge = Date.now() - sessionData.createdAt;
      const maxAge = 24 * 60 * 60 * 1000; // 24시간

      if (sessionAge > maxAge) {
        this.logger.debug(`MCP 세션 만료: ${sessionId.substring(0, 8)}...`);
        await this.redisService.deleteCache('mcp', `sessions:${sessionId}`);
        return {
          valid: false,
          message: 'MCP 세션이 만료되었습니다.',
        };
      }

      // 세션 유효
      this.logger.debug(`MCP 세션 유효: ${sessionId.substring(0, 8)}... (userId: ${sessionData.userId})`);
      return {
        valid: true,
        userId: sessionData.userId,
        message: '세션이 유효합니다.',
      };
    } catch (error) {
      this.logger.error('MCP 세션 검증 오류:', error);
      return {
        valid: false,
        message: '세션 검증 중 오류가 발생했습니다.',
      };
    }
  }
}