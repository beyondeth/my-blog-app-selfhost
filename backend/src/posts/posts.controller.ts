import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Ip, Headers, Header, UseInterceptors, Logger, ParseIntPipe, DefaultValuePipe, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PostsThrottlerGuard } from './guards/posts-throttler.guard';
import { PostsService } from './posts.service';
import { LikeQueueService } from './services/like-queue.service';
import { CreatePostDto } from './dto/create-post.dto';
import { SetThumbnailDto } from './dto/set-thumbnail.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post as PostEntity } from './entities/post.entity';
import { File as FileEntity } from '../files/entities/file.entity';
import { S3Service } from '../files/services/s3.service';
import { ViewCountService } from './view-count.service';
import { CacheInterceptor } from '../cache/cache.interceptor';
import { FilesService } from '../files/files.service';
import { CacheTTL } from '../cache/cache.decorator';
import { CacheService, CacheKeys } from '../cache/cache.service';
import { PaginationHelper } from '../common/dto/pagination.dto';
import { MonitoringService } from '../monitoring/monitoring.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name);

  constructor(
    private readonly postsService: PostsService,
    @InjectRepository(PostEntity)
    private postsRepository: Repository<PostEntity>,
    @InjectRepository(FileEntity)
    private filesRepository: Repository<FileEntity>,
    private readonly s3Service: S3Service,
    private readonly filesService: FilesService,
    private readonly viewCountService: ViewCountService,
    private readonly cacheService: CacheService,
    private readonly monitoringService: MonitoringService,
    private readonly likeQueueService: LikeQueueService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * 캐시 키 생성 헬퍼 메서드
   * 표준화된 캐시 키 생성
   */
  private generateCacheKey(params: {
    page: number;
    limit: number;
    blogSlug?: string;
    isPublished?: boolean;
    isPublicOnly?: boolean;
  }): string {
    const { page, limit, blogSlug, isPublished } = params;

    // 블로그별 피드
    if (blogSlug) {
      return CacheKeys.FEED_BLOG(blogSlug, page);
    }

    // 홈 피드 (기본값)
    if (limit === 20 && !blogSlug && isPublished === undefined) {
      return CacheKeys.FEED_HOME(page);
    }

    // published 필터가 있는 경우
    if (isPublished !== undefined) {
      return `feed:pub${isPublished ? '1' : '0'}:page:${page}`;
    }

    // 그 외의 경우 (limit이 다른 경우)
    return `feed:custom:page:${page}:limit:${limit}`;
  }

  @Post()
  @UseGuards(JwtAuthGuard, PostsThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 3600000 } }) // 시간당 15개 제한
  @ApiOperation({ summary: '게시글 작성 (시간당 15개 제한)' })
  @ApiBearerAuth()
  async create(@Body() createPostDto: CreatePostDto, @CurrentUser() user: User) {
    const newPost = await this.postsService.create(createPostDto, user);
    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨
    return newPost;
  }

  @Get()
  @Public()
  @Header('Cache-Control', 'public, max-age=120, s-maxage=120')
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '최대 20' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String, description: '카테고리 필터 (예: JavaScript, JavaScript/React)' })
  @ApiQuery({ name: 'blogSlug', required: false, type: String })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  async findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('blogSlug') blogSlug?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    // 안전한 페이지네이션 값 처리
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20); // 최대 20개
    const user = req.user || null;
    
    // 비정상적인 limit 요청 모니터링 및 데이터베이스 저장
    if (limit && parseInt(limit, 10) > 20) {
      const attemptedLimit = parseInt(limit, 10);
      this.logger.warn(`Suspicious limit request: IP=${req.ip}, limit=${attemptedLimit}, user=${user?.id || 'anonymous'}`);
      
      // 모니터링 서비스에 기록
      this.monitoringService.logExcessiveLimitRequest(
        req.ip || 'unknown',
        '/api/v1/posts',
        attemptedLimit,
        limitNumber,
        user?.id,
        user?.email,
      ).catch(err => {
        this.logger.error('Failed to log suspicious request:', err);
      });
    }
    
    // isPublished 파라미터 파싱
    let publishedFilter: boolean | undefined = undefined;
    if (isPublished === 'true') publishedFilter = true;
    else if (isPublished === 'false') publishedFilter = false;
    
    // 검색 쿼리, 카테고리 필터, 로그인 유저는 캐싱하지 않음
    if (search || category || user) {
      return this.postsService.findAll(pageNumber, limitNumber, search, category, blogSlug, user, publishedFilter, false);
    }

    // 캐시 키 생성 (공개 데이터만)
    const cacheKey = this.generateCacheKey({
      page: pageNumber,
      limit: limitNumber,
      blogSlug,
      isPublished: publishedFilter,
      isPublicOnly: true,
    });
    
    // 캐시 확인
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      console.error('Cache get error:', error);
    }
    
    // DB 조회 (캐시용 - liked 필드 제외, 공개 블로그만)
    const result = await this.postsService.findAll(
      pageNumber,
      limitNumber,
      null,  // search
      null,  // category - 캐시는 카테고리 필터 없이
      blogSlug,
      null,  // user를 null로 - liked 필드 제외
      publishedFilter,
      true   // isForCache: true - 공개 블로그만
    );
    
    // 페이지별 차등 TTL 적용 개선
    // 1페이지: 10분 (자주 접근하므로 더 길게)
    // 2-3페이지: 30분 (가끔 접근)
    // 4페이지 이상: 1시간 (거의 접근 안함)
    let ttl: number;
    if (pageNumber === 1) {
      ttl = 600;  // 10분 (기존 2분에서 연장)
    } else if (pageNumber <= 3) {
      ttl = 1800; // 30분
    } else {
      ttl = 3600; // 1시간
    }
    
    // 캐싱
    try {
      await this.cacheService.set(cacheKey, result, ttl);
      console.log(`📦 Cached ${cacheKey} with TTL ${ttl}s`);
    } catch (error) {
      console.error('Cache set error:', error);
    }
    
    return result;
  }

  @Get('popular/:period')
  @Public()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: '인기 게시글 조회 (기간별)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '조회할 개수 (기본: 5, 최대: 10)' })
  async getPopularPosts(
    @Param('period') period: 'daily' | 'weekly' | 'monthly',
    @Query('limit') limit?: string,
  ) {
    const limitNumber = PaginationHelper.getSafeLimit(limit, 10); // 인기 게시글은 최대 10개
    
    // 기간별 캐시 TTL 설정
    const ttl = period === 'daily' ? 3600 : period === 'weekly' ? 10800 : 21600;
    
    return this.postsService.findPopularPosts(period, limitNumber);
  }

  @Get('categories/public')
  @Public()
  @ApiOperation({ summary: '전체 공개 카테고리 목록 조회' })
  getCategories() {
    return this.postsService.getCategories();
  }

  @Get('category/:category')
  @Public()
  @ApiOperation({ summary: '카테고리별 게시글 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '최대 20' })
  getPostsByCategory(
    @Param('category') category: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20); // 최대 20개
    return this.postsService.getPostsByCategory(category, pageNumber, limitNumber);
  }

  @Post(':id/thumbnail')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 썸네일 설정/제거' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '썸네일 설정/제거 성공' })
  @ApiResponse({ status: 404, description: '게시글 또는 파일을 찾을 수 없음' })
  async setThumbnail(
    @Param('id') postId: string,
    @CurrentUser() user: User,
    @Body() setThumbnailDto: SetThumbnailDto,
  ) {
    return this.postsService.setThumbnail(postId, user.id, setThumbnailDto);
  }

  @Get('read')
  @Public()
  @ApiOperation({ summary: 'MCP용 포스트 읽기 (공개 포스트 검색)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async readPosts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    // MCP 전용 읽기 엔드포인트 - 공개 포스트만 검색
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20);

    // 공개 포스트만 검색
    return this.postsService.findAll(
      pageNumber,
      limitNumber,
      search,
      undefined, // category
      undefined, // blogSlug
      null,      // user (로그인 정보 없음)
      true,      // isPublished
      false      // isForCache
    );
  }

  @Get('status/:postId')
  @Public()
  @ApiOperation({
    summary: '포스트 처리 상태 조회 (Fast Path 전용)',
    description: 'Fast Path로 생성된 포스트의 백그라운드 처리 상태를 확인합니다. status 값: processing(처리중), published(완료), failed(실패)'
  })
  @ApiResponse({ status: 200, description: '포스트 상태 반환' })
  @ApiResponse({ status: 404, description: '포스트를 찾을 수 없음' })
  async getPostStatus(@Param('postId') postId: string) {
    const post = await this.postsRepository.findOne({
      where: { id: postId },
      select: [
        'id',
        'title',
        'slug',
        'status',
        'processingError',
        'processingCompletedAt',
        'isPublished',
        'publishedAt',
        'createdAt',
      ],
    });

    if (!post) {
      throw new ForbiddenException('포스트를 찾을 수 없습니다.');
    }

    return {
      id: post.id,
      title: post.title,
      slug: post.slug,
      status: post.status,
      processingError: post.processingError,
      processingCompletedAt: post.processingCompletedAt,
      isPublished: post.isPublished,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    };
  }

  @Get('slug/:slug')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Slug로 게시글 조회' })
  findBySlug(@Param('slug') slug: string, @Request() req: any) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;
    return this.postsService.findBySlug(slug, user);
  }

  @Get('view-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '조회수 배치 처리 상태 확인 (관리자)' })
  @ApiBearerAuth()
  async getViewCountStats() {
    return this.viewCountService.getViewCountStats();
  }

  @Get(':id/images')
  @Public()
  @ApiOperation({ summary: '게시글의 이미지 목록 조회 (순서포함)' })
  @ApiResponse({ 
    status: 200, 
    description: '이미지 목록 조회 성공',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', description: '파일 ID' },
          fileName: { type: 'string', description: '파일명' },
          fileKey: { type: 'string', description: 'S3 파일 키' },
          accessUrl: { type: 'string', description: '액세스 URL' },
          imageOrder: { type: 'number', description: '이미지 순서' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  })
  async getPostImages(@Param('id') postId: string) {
    return this.postsService.getPostImages(postId);
  }

  @Get('popular-tags')
  @Public()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(3600) // 1시간 캐시
  @ApiOperation({ summary: '인기 태그 목록 조회' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '반환할 태그 수 (기본값: 20)' })
  @ApiResponse({ status: 200, description: '인기 태그 목록 반환' })
  async getPopularTags(@Query('limit') limit: number = 20) {
    return this.postsService.getPopularTags(Number(limit));
  }

  @Get('editor-picks')
  @Public()
  @ApiOperation({ summary: 'Editor\'s Pick 목록 조회' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '조회할 개수 (기본: 5, 최대: 10)' })
  @ApiResponse({ status: 200, description: 'Editor\'s Pick 목록 반환' })
  async getEditorPicks(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 5;

    // 캐시 키 생성
    const cacheKey = CacheKeys.FEED_EDITOR_PICKS(limitNumber);

    // 캐시 확인
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`✅ Cache hit for ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      this.logger.error('Cache get error:', error);
    }

    // DB 조회
    const result = await this.postsService.findEditorPicks(limitNumber);

    // 캐싱 (TTL: 30분)
    try {
      await this.cacheService.set(cacheKey, result, 1800);
      this.logger.debug(`📦 Cached ${cacheKey} with TTL 1800s`);
    } catch (error) {
      this.logger.error('Cache set error:', error);
    }

    return result;
  }

  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '게시글 상세 조회' })
  findOne(@Param('id') id: string, @Request() req: any) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;
    return this.postsService.findOne(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 수정' })
  @ApiBearerAuth()
  async update(@Param('id') id: string, @Body() updatePostDto: any, @CurrentUser() user: User) {
    const updated = await this.postsService.update(id, updatePostDto, user);
    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨
    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiBearerAuth()
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.postsService.remove(id, user);
    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨
    return result;
  }

  @Post(':id/like')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '게시글 좋아요 토글 (Redis Queue 시스템)' })
  async toggleLike(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // OptionalJwtAuthGuard로 인증 확인
    const user = req.user || null;

    if (!user) {
      throw new ForbiddenException('로그인이 필요합니다.');
    }

    console.log('toggleLike called with user:', `${user.username} (${user.id})`);

    // Redis pending 키로 연속 클릭 감지 (Race Condition 방지)
    const pendingKey = `likes:pending:${user.id}:${id}`;
    const pendingData = await this.redis.get(pendingKey);

    let action: 'like' | 'unlike';
    let actionDecided = false; // action이 이미 결정되었는지 추적

    // 1. Pending 확인 및 action 결정
    if (pendingData) {
      try {
        const { action: pendingAction } = JSON.parse(pendingData);
        action = pendingAction === 'like' ? 'unlike' : 'like';
        actionDecided = true;
        console.log(`⚡ [Fast Toggle] pending=${pendingAction} → action=${action}`);
      } catch (e) {
        console.log(`⚠️ [Pending Parse Failed] Fallback to DB query`);
      }
    }

    // 2. 원자적 쿼리로 isLiked와 likeCount를 동시에 조회 (Race Condition 방지)
    const result = await this.postsRepository.manager.query(
      `SELECT
        EXISTS(SELECT 1 FROM post_likes WHERE "postId" = $1 AND "userId" = $2) as is_liked,
        p."likeCount"
       FROM posts p
       WHERE p.id = $1`,
      [id, user.id]
    );

    const isLiked = result[0]?.is_liked || false;
    const currentLikeCount = parseInt(result[0]?.likeCount) || 0;

    // 3. action이 아직 결정되지 않았으면 DB 결과로 결정 (첫 클릭 또는 pending 파싱 실패)
    if (!actionDecided) {
      action = isLiked ? 'unlike' : 'like';
      console.log(`🔍 [First Toggle] isLiked=${isLiked} → action=${action}`);
    }

    const expectedLikeCount = action === 'like'
      ? currentLikeCount + 1
      : Math.max(0, currentLikeCount - 1);

    // Redis 큐에 추가 (즉시 응답)
    await this.likeQueueService.queueLike(id, user.id, action);

    // 클라이언트에게 즉시 응답 (낙관적 업데이트용)
    // liked: 토글 후 예상 상태 (action='like' → true, action='unlike' → false)
    // likeCount: 토글 후 예상 개수
    return {
      success: true,
      queued: true,
      postId: id,
      liked: action === 'like',
      likeCount: expectedLikeCount
    };
  }

  @Post('generate-slugs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '기존 게시글에 slug 생성 (관리자만)' })
  @ApiBearerAuth()
  async generateSlugs() {
    await this.postsService.generateMissingSlugs();
    return { message: 'Slugs generated successfully' };
  }

  @Post('relink-files')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '기존 게시글의 파일 연결 재처리 (관리자만)' })
  @ApiBearerAuth()
  async relinkFiles() {
    await this.postsService.relinkContentFiles();
    return { message: 'Files relinked successfully' };
  }

  @Post(':id/view')
  @Public()
  @ApiOperation({ summary: '게시글 조회수 증가 (배치 처리)' })
  @ApiResponse({ status: 200, description: '조회수 증가 성공 (배치 대기중)' })
  @ApiResponse({ status: 404, description: '게시글을 찾을 수 없음' })
  async incrementViewCount(@Param('id') id: string) {
    // 배치 서비스로 조회수 증가 (메모리에 임시 저장)
    await this.viewCountService.incrementViewCount(id);
    return { message: 'View count queued for batch update' };
  }

  @Patch(':id/editor-pick')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Editor\'s Pick 토글 (관리자 전용)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'Editor\'s Pick 토글 성공' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  @ApiResponse({ status: 404, description: '게시글을 찾을 수 없음' })
  async toggleEditorPick(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.postsService.toggleEditorPick(id, user);
    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨
    return result;
  }

  // ===================================================
  // 좋아요 큐 모니터링 엔드포인트 (Grafana용)
  // ===================================================

  @Public()
  @Get('queue/metrics')
  @ApiOperation({
    summary: '좋아요 큐 메트릭 조회',
    description: 'Grafana 대시보드에서 사용할 좋아요 큐 메트릭 정보 (큐 크기, 처리율, 평균 처리 시간 등)'
  })
  @ApiResponse({
    status: 200,
    description: '큐 메트릭',
    schema: {
      type: 'object',
      properties: {
        queueSize: { type: 'number', description: '현재 큐에 대기 중인 좋아요 요청 수' },
        dlqSize: { type: 'number', description: 'Dead Letter Queue 크기' },
        processingRate: { type: 'number', description: '처리율 (requests/second)' },
        averageProcessingTime: { type: 'number', description: '평균 처리 시간 (ms)' },
        lastProcessedAt: { type: 'string', format: 'date-time', description: '마지막 처리 시간' },
        failureRate: { type: 'number', description: '실패율 (0.0 ~ 1.0)' },
      }
    }
  })
  async getLikeQueueMetrics() {
    return this.likeQueueService.getMetrics();
  }

  @Public()
  @Get('queue/health')
  @ApiOperation({
    summary: '좋아요 큐 건강 상태 조회',
    description: '큐의 건강 상태, 샤드별 분포, 경고 메시지 확인'
  })
  @ApiResponse({
    status: 200,
    description: '큐 건강 상태',
    schema: {
      type: 'object',
      properties: {
        healthy: { type: 'boolean', description: '건강 여부' },
        totalSize: { type: 'number', description: '전체 큐 크기' },
        distribution: {
          type: 'object',
          description: '샤드별 큐 크기 분포',
          additionalProperties: { type: 'number' }
        },
        warnings: {
          type: 'array',
          items: { type: 'string' },
          description: '경고 메시지 목록'
        },
      }
    }
  })
  async getLikeQueueHealth() {
    return this.likeQueueService.getQueueHealth();
  }

  @Post('queue/recover-dlq')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Dead Letter Queue에서 좋아요 요청 복구 (관리자 전용)',
    description: '실패한 좋아요 요청을 DLQ에서 가져와 다시 큐에 추가'
  })
  @ApiResponse({ status: 200, description: '복구 완료' })
  @ApiResponse({ status: 403, description: '권한 없음' })
  async recoverDeadLetterQueue(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    const recovered = await this.likeQueueService.recoverFromDeadLetterQueue(limit);
    return {
      recovered: recovered.length,
      message: `${recovered.length}개 좋아요 요청이 복구되었습니다.`
    };
  }

  /**
   * 사용자의 모든 카테고리 목록 조회 (자동완성용)
   *
   * @description
   * 로그인한 사용자가 작성한 포스트의 카테고리 목록을 반환합니다.
   * 사용 빈도순으로 정렬되어 자동완성 UI에서 사용됩니다.
   *
   * @returns 카테고리 목록 (문자열 배열)
   */
  @Get('categories')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '사용자의 카테고리 목록 조회 (자동완성용)' })
  @ApiResponse({
    status: 200,
    description: '카테고리 목록 (사용 빈도순)',
    schema: {
      type: 'array',
      items: { type: 'string' },
      example: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
    },
  })
  async getUserCategories(@CurrentUser() user: User): Promise<string[]> {
    return this.postsService.getUserCategories(user.id);
  }
} 