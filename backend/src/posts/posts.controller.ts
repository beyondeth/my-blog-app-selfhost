import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Ip, Headers, Header, UseInterceptors, Logger, ParseIntPipe, ParseUUIDPipe, DefaultValuePipe, ForbiddenException, NotFoundException, Inject, forwardRef, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PostsThrottlerGuard } from './guards/posts-throttler.guard';
import { PostsService } from './posts.service';
import { LikeService } from './services/like.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { SetThumbnailDto } from './dto/set-thumbnail.dto';
import { GetPostsCursorDto } from './dto/get-posts-cursor.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post as PostEntity } from './entities/post.entity';
import { UrlSanitizerUtil } from '../common/utils/url-sanitizer.util';
import { File as FileEntity } from '../files/entities/file.entity';
import { S3Service } from '../files/services/s3.service';
import { ViewCountService } from './view-count.service';
import { CacheInterceptor } from '../cache/cache.interceptor';
import { FilesService } from '../files/files.service';
import { CacheService, CacheKeys, CacheTTL } from '../cache/cache.service';
import { CacheTTL as CacheTTLDecorator } from '../cache/cache.decorator';
import { PaginationHelper } from '../common/dto/pagination.dto';
import { MonitoringService } from '../monitoring/monitoring.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { BlogResolverService } from '../common/services/blog-resolver.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  private readonly logger = new Logger(PostsController.name);

  constructor(
    private readonly postsService: PostsService,
    private readonly blogResolverService: BlogResolverService,
    @InjectRepository(PostEntity)
    private postsRepository: Repository<PostEntity>,
    @InjectRepository(FileEntity)
    private filesRepository: Repository<FileEntity>,
    private readonly s3Service: S3Service,
    private readonly filesService: FilesService,
    private readonly viewCountService: ViewCountService,
    private readonly cacheService: CacheService,
    private readonly monitoringService: MonitoringService,
    private readonly likeService: LikeService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  /**
   * 캐시 키 생성 헬퍼 메서드
   * 표준화된 캐시 키 생성
   */
  private generateCacheKey(params: {
    page: number;
    limit: number;
    blogId?: string;
    isPublished?: boolean;
    isPublicOnly?: boolean;
  }): string {
    const { page, limit, blogId, isPublished } = params;

    // 블로그별 피드
    if (blogId) {
      return CacheKeys.FEED_BLOG(blogId, page);
    }

    // 홈 피드 (기본값)
    if (limit === 20 && !blogId && isPublished === undefined) {
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
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '최대 20' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'category', required: false, type: String, description: '카테고리 필터 (예: JavaScript, JavaScript/React)' })
  @ApiQuery({ name: 'blogId', required: false, type: String })
  @ApiQuery({ name: 'blogSlug', required: false, type: String, description: '블로그 alias (@alias 형식)' })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  async findAll(
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('blogId') blogId?: string,
    @Query('blogSlug') blogSlug?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    // 안전한 페이지네이션 값 처리
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20); // 최대 20개
    const user = req.user || null;

    // 인증된 사용자에게는 캐시 비활성화 헤더 설정 (즉시 반영 보장)
    if (user) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    // blogSlug가 있으면 blogId로 변환 (@alias 시스템 지원)
    let actualBlogId = blogId;
    if (blogSlug && !blogId) {
      try {
        // blogSlug에서 @ 제거
        const cleanAlias = blogSlug.startsWith('@') ? blogSlug.slice(1) : blogSlug;
        const blog = await this.blogResolverService.resolveBlogByIdentifier(cleanAlias);
        actualBlogId = blog?.id;
      } catch (error) {
        this.logger.warn(`Failed to resolve blogSlug ${blogSlug} to blogId:`, error);
        actualBlogId = null;
      }
    }
    
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
      return this.postsService.findAll(pageNumber, limitNumber, search, category, actualBlogId, user, publishedFilter, false);
    }

    // 캐시 키 생성 (공개 데이터만)
    const cacheKey = this.generateCacheKey({
      page: pageNumber,
      limit: limitNumber,
      blogId: actualBlogId,
      isPublished: publishedFilter,
      isPublicOnly: true,
    });
    
    // 캐시 확인
    try {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        // 캐시 히트 로깅 (성능 모니터링용)
        const cacheType = actualBlogId ? 'MY_BLOG' : 'HOME_FEED';
        console.log(`✅ [Cache HIT] ${cacheType} for ${cacheKey}`);
        this.logger.log(`[Cache HIT] ${cacheType} - ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      console.error('Cache get error:', error);
      this.logger.error(`Cache get error for ${cacheKey}:`, error);
    }
    
    // DB 조회 (캐시용 - liked 필드 제외, 공개 블로그만)
    const result = await this.postsService.findAll(
      pageNumber,
      limitNumber,
      null,  // search
      null,  // category - 캐시는 카테고리 필터 없이
      actualBlogId,
      null,  // user를 null로 - liked 필드 제외
      publishedFilter,
      true   // isForCache: true - 공개 블로그만
    );
    
    // 홈 피드와 내 블로그에 따라 다른 TTL 적용
    // 홈 피드(공개): 30초 (성능 우선)
    // 내 블로그(개인): 10초 (즉시 반영)
    let ttl: number;
    if (actualBlogId) {
      // 내 블로그: 짧은 TTL
      ttl = CacheTTL.MY_BLOG; // 10초
    } else {
      // 홈 피드: 긴 TTL
      ttl = pageNumber === 1 ? CacheTTL.HOME_FEED : CacheTTL.HOME_FEED * 2;
    }

    // 캐시 미스 로깅
    const cacheType = actualBlogId ? 'MY_BLOG' : 'HOME_FEED';
    console.log(`❌ [Cache MISS] ${cacheType} for ${cacheKey} - Querying DB`);
    this.logger.log(`[Cache MISS] ${cacheType} - ${cacheKey}, TTL: ${ttl}s`);

    // 캐싱
    try {
      await this.cacheService.set(cacheKey, result, ttl);
      console.log(`📦 [Cache SET] ${cacheType} for ${cacheKey} with TTL ${ttl}s`);
      this.logger.log(`[Cache SET] ${cacheType} - ${cacheKey}, TTL: ${ttl}s`);
    } catch (error) {
      console.error('Cache set error:', error);
      this.logger.error(`Cache set error for ${cacheKey}:`, error);
    }
    
    return result;
  }

  @Get('popular/:period')
  @Public()
  @ApiOperation({ summary: '인기 게시글 조회 (기간별)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '조회할 개수 (기본: 5, 최대: 10)' })
  async getPopularPosts(
    @Param('period') period: string,
    @Query('limit') limit?: string,
  ) {
    // period 파라미터 안전하게 검증
    const validPeriods = ['daily', 'weekly', 'monthly'];
    const sanitizedPeriod = validPeriods.includes(period)
      ? period as 'daily' | 'weekly' | 'monthly'
      : 'weekly'; // 기본값: 주간
    const limitNumber = PaginationHelper.getSafeLimit(limit, 10); // 인기 게시글은 최대 10개

    // 캐시 키 생성
    const cacheKey = CacheKeys.FEED_POPULAR(sanitizedPeriod, limitNumber);

    // 캐시 확인
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit: ${cacheKey}`);
      return cached;
    }

    // 캐시 미스 - DB 조회
    this.logger.debug(`Cache miss: ${cacheKey}`);
    const posts = await this.postsService.findPopularPosts(sanitizedPeriod, limitNumber);

    // 응답 포맷팅 (프론트엔드에서 기대하는 형식: { posts: [...], total: number })
    const result = {
      posts: posts,
      total: posts.length
    };

    // 기간별 캐시 TTL 설정 후 캐싱
    const ttl = sanitizedPeriod === 'daily' ? 3600 : sanitizedPeriod === 'weekly' ? 10800 : 21600;
    await this.cacheService.set(cacheKey, result, ttl);
    this.logger.debug(`Cached: ${cacheKey} (TTL: ${ttl}s)`);

    return result;
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
    // 카테고리 파라미터 안전하게 정제
    const sanitizedCategory = UrlSanitizerUtil.sanitizeUserInput(category);
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20); // 최대 20개
    return this.postsService.getPostsByCategory(sanitizedCategory, pageNumber, limitNumber);
  }

  @Post(':id/thumbnail')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 썸네일 설정/제거' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '썸네일 설정/제거 성공' })
  @ApiResponse({ status: 404, description: '게시글 또는 파일을 찾을 수 없음' })
  async setThumbnail(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
    @Body() setThumbnailDto: SetThumbnailDto,
  ) {
    return this.postsService.setThumbnail(postId, user.id, setThumbnailDto);
  }

  @Get(':id/thumbnail/candidates')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 썸네일 후보 이미지 조회' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '썸네일 후보 목록 반환' })
  @ApiResponse({ status: 404, description: '게시글을 찾을 수 없음' })
  async getThumbnailCandidates(
    @Param('id', ParseUUIDPipe) postId: string,
    @CurrentUser() user: User,
  ) {
    return this.postsService.getThumbnailCandidates(postId, user.id);
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

    // URL 파라미터 안전하게 디코딩 및 정제
    const sanitizedSlug = UrlSanitizerUtil.sanitizeSlug(slug);

    return this.postsService.findBySlug(sanitizedSlug, user);
  }

  @Get(':blogId/:slug')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '블로그 ID와 슬러그로 게시글 조회 (프론트엔드 호환성)' })
  findByBlogIdAndSlug(
    @Param('blogId', ParseUUIDPipe) blogId: string,
    @Param('slug') slug: string,
    @Request() req: any,
  ) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;

    // URL 파라미터 안전하게 디코딩 및 정제
    const sanitizedSlug = UrlSanitizerUtil.sanitizeSlug(slug);

    // blogId는 validation 용도로만 사용하고, 실제로는 slug로 조회
    return this.postsService.findBySlug(sanitizedSlug, user);
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
  async getPostImages(@Param('id', ParseUUIDPipe) postId: string) {
    return this.postsService.getPostImages(postId);
  }

  @Get('popular-tags')
  @Public()
  @UseInterceptors(CacheInterceptor)
  @CacheTTLDecorator(3600) // 1시간 캐시
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
    const posts = await this.postsService.findEditorPicks(limitNumber);

    // 응답 포맷팅 (프론트엔드에서 기대하는 형식: { posts: [...], total: number })
    const result = {
      posts: posts,
      total: posts.length
    };

    // 캐싱 (TTL: 24시간)
    try {
      await this.cacheService.set(cacheKey, result, 86400);
      this.logger.debug(`📦 Cached ${cacheKey} with TTL 86400s (24 hours)`);
    } catch (error) {
      this.logger.error('Cache set error:', error);
    }

    return result;
  }
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 수정' })
  @ApiBearerAuth()
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() updatePostDto: UpdatePostDto, @CurrentUser() user: User) {
    // 🎯 [THUMBNAIL_TRACK] STEP_4_BACKEND_RECEIVE
    if ('thumbnailImageId' in updatePostDto || 'thumbnail' in updatePostDto) {
      this.logger.log('🎯 [THUMBNAIL_TRACK] STEP_4_BACKEND_RECEIVE: Post update request received');
      this.logger.debug(`  - Post ID: ${id}`);
      this.logger.debug(`  - User ID: ${user.id}`);
      this.logger.debug(`  - thumbnailImageId: ${updatePostDto.thumbnailImageId}`);
      this.logger.debug(`  - thumbnail: (removed - using thumbnailImageId only)`);
      this.logger.debug(`  - Timestamp: ${new Date().toISOString()}`);
    }

    const updated = await this.postsService.update(id, updatePostDto, user);
    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨

    // 🎯 [THUMBNAIL_TRACK] STEP_4_BACKEND_SUCCESS
    if ('thumbnailImageId' in updatePostDto || 'thumbnail' in updatePostDto) {
      this.logger.log('🎯 [THUMBNAIL_TRACK] STEP_4_BACKEND_SUCCESS: Post update completed');
    }

    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiBearerAuth()
  async remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    const result = await this.postsService.remove(id, user);
    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨
    return result;
  }

  @Post(':id/like')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '게시글 좋아요 토글 (즉시 처리)' })
  async toggleLike(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    // OptionalJwtAuthGuard로 인증 확인
    const user = req.user || null;

    if (!user) {
      throw new ForbiddenException('로그인이 필요합니다.');
    }

    console.log('toggleLike called with user:', `${user.username} (${user.id})`);

    // 단순화된 좋아요 서비스로 즉시 처리
    const result = await this.likeService.toggleLike(id, user.id);

    // 클라이언트에게 즉시 실제 응답
    return {
      success: true,
      postId: id,
      liked: result.liked,
      likeCount: result.likeCount
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
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    // Editor's Pick 토글 실행 - 정확한 값을 반환받음
    const result = await this.postsService.toggleEditorPick(id, user);

    // 업데이트된 포스트 전체 데이터 반환
    // 경쟁 상태를 피하기 위해 포스트를 다시 조회할 때는 캐시를 우회하거나
    // 최신 데이터를 보장받아야 함
    const post = await this.postsService.findOne(id, user);
    if (!post) {
      throw new NotFoundException('포스트를 찾을 수 없습니다.');
    }

    // findBySlug를 사용하여 isEditorPick 필드가 포함된 전체 데이터 조회
    // 단, toggleEditorPick에서 반환된 결과를 사용하여 isEditorPick 값을 보장
    const updatedPost = await this.postsService.findBySlug(post.slug, user);

    // 서비스에서 반환된 최신값으로 isEditorPick 설정 (경쟁 상태 방지)
    updatedPost.isEditorPick = result.isEditorPick;

    // 캐시 무효화는 EventEmitter를 통한 이벤트 기반으로 처리됨
    return updatedPost;
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

  /**
   * Cursor Pagination으로 포스트 목록 조회
   *
   * @description
   * 무한 스크롤 UI를 위한 커서 기반 페이지네이션 엔드포인트
   *
   * @성능_장점
   * - OFFSET 방식: 10만번째 페이지 조회 시 28ms (99,999개 스캔)
   * - CURSOR 방식: 10만번째 페이지 조회 시 3ms (인덱스 직접 접근)
   * - 대규모 데이터셋에서 일정한 응답속도 보장 O(1)
   *
   * @일관성_보장
   * - 새 포스트 추가 시 중복/누락 없음
   * - OFFSET 방식: 1페이지 조회 → 새 포스트 추가 → 2페이지 조회 시 1번 포스트 중복
   * - CURSOR 방식: 마지막 아이템 기준으로 조회하므로 중복 없음
   *
   * @프론트엔드_사용예시
   * ```typescript
   * // React Query Infinite Scroll
   * const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
   *   queryKey: ['posts', 'cursor', sort],
   *   queryFn: ({ pageParam }) =>
   *     fetch(`/api/v1/posts/cursor?cursor=${pageParam || ''}&sort=${sort}`),
   *   getNextPageParam: (lastPage) => lastPage.nextCursor,
   * });
   * ```
   *
   * @returns CursorPaginatedPostsDto (posts, nextCursor, hasMore, count)
   */
  @Get('cursor')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({
    summary: 'Cursor Pagination 포스트 목록 조회',
    description: '무한 스크롤을 위한 커서 기반 페이지네이션. 대규모 데이터셋에서도 일정한 성능 보장 (O(1))',
  })
  @ApiQuery({ name: 'cursor', required: false, type: String, description: 'Base64 인코딩된 커서 (첫 페이지는 생략)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 항목 수 (기본: 20, 최대: 50)' })
  @ApiQuery({ name: 'sort', required: false, enum: ['recent', 'popular', 'trending'], description: '정렬 방식 (기본: recent)' })
  @ApiQuery({ name: 'category', required: false, type: String, description: '카테고리 필터' })
  @ApiQuery({ name: 'blogSlug', required: false, type: String, description: '블로그 슬러그 필터' })
  @ApiQuery({ name: 'blogId', required: false, type: String, description: '블로그 ID 필터' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '검색 키워드' })
  @ApiResponse({
    status: 200,
    description: 'Cursor Pagination 결과',
    schema: {
      type: 'object',
      properties: {
        posts: { type: 'array', items: { type: 'object' } },
        nextCursor: { type: 'string', nullable: true, description: '다음 페이지 커서 (null이면 마지막 페이지)' },
        hasMore: { type: 'boolean', description: '다음 페이지 존재 여부' },
        count: { type: 'number', description: '현재 페이지 아이템 수' },
      },
    },
  })
  async getPostsCursor(
    @Query() dto: GetPostsCursorDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;

    // 인증된 사용자에게는 캐시 비활성화 헤더 설정 (즉시 반영 보장)
    if (user) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }

    return this.postsService.getPostsCursor(dto, user);
  }

  /**
   * Sitemap 생성을 위한 모든 발행된 포스트 조회
   *
   * @description
   * SEO 최적화를 위해 sitemap.xml 생성 시 사용되는 엔드포인트입니다.
   * - 인증 불필요 (@Public)
   * - 발행된 포스트만 반환 (isPublished = true)
   * - 공개 블로그의 포스트만 포함 (isPublic = true)
   * - 최소 데이터만 반환 (slug, blogSlug, updatedAt)
   * - 페이지네이션 없이 전체 데이터 반환
   * - 성능 최적화를 위해 최소 필드만 SELECT
   *
   * @returns 발행된 포스트의 slug, blogSlug, updatedAt 배열
   */
  @Get('sitemap/all')
  @Public()
  @ApiOperation({ summary: 'Sitemap용 모든 발행된 포스트 조회' })
  @ApiResponse({
    status: 200,
    description: '발행된 포스트 목록 (slug, blogSlug, updatedAt)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          slug: { type: 'string', example: 'my-first-post' },
          blogSlug: { type: 'string', example: 'john-blog' },
          updatedAt: { type: 'string', format: 'date-time', example: '2025-01-20T12:00:00.000Z' },
        },
      },
    },
  })
  async getAllPostsForSitemap(): Promise<Array<{ slug: string; blogSlug: string; updatedAt: Date }>> {
    return this.postsService.getAllPublishedPostsForSitemap();
  }

  // ⚠️ 주의: 이 라우트는 반드시 모든 정적 라우트 아래에 위치해야 합니다.
  // 와일드카드 :id 파라미터가 /posts/categories, /posts/popular 등을 가로채지 않도록 함
  @Get(':id')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '게시글 상세 조회' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;
    const post = await this.postsService.findOne(id, user);

    // 삭제된 포스트면 410 Gone 응답
    if (post && post.isDeleted) {
      throw new NotFoundException('삭제된 포스트입니다');
    }

    return post;
  }
} 