import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Ip, Headers } from '@nestjs/common';
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
import { FilesService } from '../files/files.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    @InjectRepository(PostEntity)
    private postsRepository: Repository<PostEntity>,
    @InjectRepository(FileEntity)
    private filesRepository: Repository<FileEntity>,
    private readonly s3Service: S3Service,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, PostsThrottlerGuard)
  @Throttle({ default: { limit: 15, ttl: 3600000 } }) // 시간당 15개 제한
  @ApiOperation({ summary: '게시글 작성 (시간당 15개 제한)' })
  @ApiBearerAuth()
  create(@Body() createPostDto: CreatePostDto, @CurrentUser() user: User) {
    return this.postsService.create(createPostDto, user);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: '게시글 목록 조회' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'blogSlug', required: false, type: String })
  @ApiQuery({ name: 'isPublished', required: false, type: Boolean })
  findAll(
    @Request() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('blogSlug') blogSlug?: string,
    @Query('isPublished') isPublished?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const user = req.user || null;
    
    // isPublished 파라미터 파싱
    let publishedFilter: boolean | undefined = undefined;
    if (isPublished === 'true') publishedFilter = true;
    else if (isPublished === 'false') publishedFilter = false;
    
    return this.postsService.findAll(pageNumber, limitNumber, search, blogSlug, user, publishedFilter);
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getPostsByCategory(
    @Param('category') category: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
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

  @Get('slug/:slug')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Slug로 게시글 조회' })
  findBySlug(@Param('slug') slug: string, @Request() req: any) {
    // OptionalJwtAuthGuard로 인증 확인 (로그인 안 해도 접근 가능)
    const user = req.user || null;
    return this.postsService.findBySlug(slug, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 수정' })
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() updatePostDto: any, @CurrentUser() user: User) {
    return this.postsService.update(id, updatePostDto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.USER)
  @ApiOperation({ summary: '게시글 삭제' })
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.postsService.remove(id, user);
  }

  @Post(':id/like')
  @Public()
  @ApiOperation({ summary: '게시글 좋아요 토글 (로그인/비로그인 모두 지원)' })
  async toggleLike(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    // @Public()과 함께 사용할 때는 req.user를 직접 사용
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
  @ApiOperation({ summary: '게시글 조회수 증가' })
  @ApiResponse({ status: 200, description: '조회수 증가 성공' })
  @ApiResponse({ status: 404, description: '게시글을 찾을 수 없음' })
  async incrementViewCount(@Param('id') id: string) {
    await this.postsService.incrementViewCount(id);
    return { message: 'View count incremented' };
  }
} 