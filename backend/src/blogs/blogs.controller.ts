import { Controller, Get, Post, Put, Body, Param, UseGuards, Request, UnauthorizedException } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';

@Controller('blogs')
export class BlogsController {
  constructor(private readonly blogsService: BlogsService) {}

  @Post()
  async create(@Body() createBlogDto: CreateBlogDto, @CurrentUser() user: User) {
    return await this.blogsService.create(createBlogDto, user);
  }

  @Get('check-slug/:slug')
  @Public()
  async checkSlug(@Param('slug') slug: string) {
    const available = await this.blogsService.checkSlugAvailability(slug);
    return { available };
  }

  @Get('my-blogs')
  async getMyBlogs(@CurrentUser() user: User) {
    return await this.blogsService.findByUserId(user.id);
  }

  @Get('slug/:slug')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  async findOneBySlug(@Param('slug') slug: string, @CurrentUser() user?: User) {
    console.log(`[BlogsController] findOneBySlug - slug: ${slug}, user: ${user?.id || 'none'}`);
    return await this.blogsService.findOneBySlug(slug, user);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return await this.blogsService.findOne(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateBlogDto: UpdateBlogDto,
    @CurrentUser() user: User
  ) {
    // 블로그 소유자 확인
    const blog = await this.blogsService.findOne(id);
    if (blog.userId !== user.id) {
      throw new UnauthorizedException('블로그를 수정할 권한이 없습니다.');
    }
    return await this.blogsService.update(id, updateBlogDto);
  }
}