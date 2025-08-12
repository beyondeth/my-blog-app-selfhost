import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { BlogsService } from './blogs.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

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
  async findOneBySlug(@Param('slug') slug: string) {
    return await this.blogsService.findOneBySlug(slug);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string) {
    return await this.blogsService.findOne(id);
  }
}