import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Ip, Headers, UseInterceptors, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PostsThrottlerGuard } from './guards/posts-throttler.guard';
import { PostsService } from './posts.service';
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
import { CacheService } from '../cache/cache.service';
import { PaginationHelper } from '../common/dto/pagination.dto';
import { MonitoringService } from '../monitoring/monitoring.service';

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
  ) {}

  /**
   * 캐시 키 생성 헬퍼 메서드
   * 일관된 캐시 키 생성을 보장하고, 캐시 관리를 쉽게 만듦
   *
   * 캐시 히트율 개선 전략:
   * 1. 기본값(limit=10)은 단순한 키 사용
   * 2. 자주 사용되는 조합만 캐싱
   * 3. 블로그별 캐시는 활성 블로그만
   */
  private generateCacheKey(params: {
    page: number;
    limit: number;
    blogSlug?: string;
    isPublished?: boolean;
    isPublicOnly?: boolean;
  }): string {
    const { page, limit, blogSlug, isPublished, isPublicOnly = true } = params;

    // 기본값인 경우 단순한 캐시 키 사용 (대부분의 사용자가 이 조합 사용)
    if (limit === 10 && !blogSlug && isPublished === undefined) {
      return `feed:main:p${page}`;  // 더 짧은 키로 메모리 절약
    }

    // 블로그별 피드
    if (blogSlug) {
      // 블로그+페이지만 포함 (limit 제외하여 캐시 히트율 상승)
      return `feed:blog:${blogSlug}:p${page}`;
    }

    // published 필터가 있는 경우
    if (isPublished !== undefined) {
      return `feed:pub${isPublished ? '1' : '0'}:p${page}`;
    }

    // 그 외의 경우 (limit이 다른 경우)
    return `feed:custom:p${page}:l${limit}`;
  }

  @Post()
  @UseGuards(JwtAuthGuard, PostsThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 3600000 } }) // 시간당 15개 제한
  @ApiOperation({ summary: '게시글 작성 (시간당 15개 제한)' })
  @ApiBearerAuth()
  async create(@Body() createPostDto: CreatePostDto, @CurrentUser() user: User) {
    const newPost = await this.postsService.create(createPostDto, user);
    
    // 스마트 캐시 무효화: 1-3페이지만 무효화 (대부분 사용자가 보는 범위)
    try {
      // 1. 메인 피드 1-3페이지만 무효화 (전체 삭제 대신)
      await this.cacheService.delete('feed:main:p1');
      await this.cacheService.delete('feed:main:p2');
      await this.cacheService.delete('feed:main:p3');
      console.log('✅ Smart cache invalidation: cleared pages 1-3 only');
      
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

      // 캐시에 저장 (TTL: 10분으로 연장)
      await this.cacheService.set('feed:main:p1', freshData, 600);
      console.log('🔥 Cache warmed: First page pre-cached with new post');
    } catch (error) {
      console.error('❌ Failed to invalidate/warm first page cache:', error);
      // 캐시 무효화 실패해도 포스트 생성은 성공
    }
    
    return newPost;
  }

  @Get()
  @Public()
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '최대 20' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'blogSlug', required: false, type: String })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  async findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
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
    
    // 검색 쿼리나 로그인 유저는 캐싱하지 않음
    if (search || user) {
      return this.postsService.findAll(pageNumber, limitNumber, search, blogSlug, user, publishedFilter, false);
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
      null, 
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

  @Get('categories')
  @Public()
  @ApiOperation({ summary: '카테고리 목록 조회' })
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
      undefined, // blogSlug
      null,      // user (로그인 정보 없음)
      true,      // isPublished
      false      // isForCache
    );
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
    
    // 스마트 캐시 무효화: 영향받는 페이지만 무효화
    try {
      // 메인 피드 1-3페이지 무효화
      await this.cacheService.delete('feed:main:p1');
      await this.cacheService.delete('feed:main:p2');
      await this.cacheService.delete('feed:main:p3');

      // 블로그별 피드도 무효화 (해당 블로그만)
      const post = await this.postsRepository.findOne({
        where: { id },
        relations: ['blog', 'author']
      });
      // 작성자 확인 후 블로그 캐시 무효화
      if (post?.author?.id === user.id && post?.blog) {
        await this.cacheService.deletePattern(`feed:blog:${post.blog.slug}:*`);
      }

      console.log('✅ Smart cache invalidation after post update');
    } catch (error) {
      console.error('❌ Failed to invalidate feed cache:', error);
    }
    
    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiBearerAuth()
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    const result = await this.postsService.remove(id, user);
    
    // 스마트 캐시 무효화: 영향받는 페이지만 무효화
    try {
      // 메인 피드 1-5페이지 무효화 (삭제는 더 많은 페이지에 영향)
      for (let i = 1; i <= 5; i++) {
        await this.cacheService.delete(`feed:main:p${i}`);
      }

      // 블로그별 피드도 무효화 (해당 블로그만)
      const post = await this.postsRepository.findOne({
        where: { id },
        relations: ['blog', 'author']
      });
      // 작성자 확인 후 블로그 캐시 무효화
      if (post?.author?.id === user.id && post?.blog) {
        await this.cacheService.deletePattern(`feed:blog:${post.blog.slug}:*`);
      }

      console.log('✅ Smart cache invalidation after post deletion');
    } catch (error) {
      console.error('❌ Failed to invalidate feed cache:', error);
    }
    
    return result;
  }

  @Post(':id/like')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: '게시글 좋아요 토글 (로그인/비로그인 모두 지원)' })
  async toggleLike(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;
    console.log('toggleLike called with user:', user ? `${user.username} (${user.id})` : 'null');
    return this.postsService.toggleLike(id, user);
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
} 