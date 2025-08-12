import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Request, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { PostsService } from './posts.service';
import { CreatePostDto } from './dto/create-post.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
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
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '게시글 작성' })
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
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('blogSlug') blogSlug?: string,
  ) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    return this.postsService.findAll(pageNumber, limitNumber, search, blogSlug);
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

  @Get(':id')
  @Public()
  @ApiOperation({ summary: '게시글 상세 조회' })
  findOne(@Param('id') id: string) {
    return this.postsService.findOne(id);
  }

  @Get('slug/:slug')
  @Public()
  @ApiOperation({ summary: 'Slug로 게시글 조회' })
  findBySlug(@Param('slug') slug: string) {
    return this.postsService.findBySlug(slug);
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
    @CurrentUser() user: any,
  ) {
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
} 