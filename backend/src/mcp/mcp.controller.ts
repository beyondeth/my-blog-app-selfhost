import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Headers, UnauthorizedException } from '@nestjs/common';
import { McpService } from './mcp.service';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { UpdatePostDto } from '../posts/dto/update-post.dto';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeysService } from '../api-keys/api-keys.service';

@Controller('mcp')
@Public() // Bypass JWT auth, we'll use API key auth instead
export class McpController {
  constructor(
    private readonly mcpService: McpService,
    private readonly apiKeysService: ApiKeysService,
  ) {}

  private async validateApiKey(headers: any) {
    const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      throw new UnauthorizedException('API 키가 필요합니다.');
    }

    const validation = await this.apiKeysService.validateApiKey(apiKey);
    
    if (!validation.valid) {
      throw new UnauthorizedException('유효하지 않은 API 키입니다.');
    }

    return validation.apiKey;
  }

  /**
   * 포스트 생성
   */
  @Post('posts')
  async createPost(@Body() createPostDto: CreatePostDto, @Headers() headers) {
    const apiKey = await this.validateApiKey(headers);
    const blog = apiKey.blog;
    const user = apiKey.user;
    return await this.mcpService.createPost(createPostDto, blog, user);
  }

  /**
   * 포스트 목록 조회
   */
  @Get('posts')
  async getPosts(
    @Headers() headers,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const apiKey = await this.validateApiKey(headers);
    const pageNumber = page ? parseInt(page, 10) : 1;
    const limitNumber = limit ? parseInt(limit, 10) : 10;
    const blogId = apiKey.blog.id;
    
    return await this.mcpService.getPosts(blogId, pageNumber, limitNumber);
  }

  /**
   * 포스트 수정
   */
  @Put('posts/:id')
  async updatePost(
    @Param('id') id: string,
    @Body() updateData: UpdatePostDto,
    @Headers() headers,
  ) {
    const apiKey = await this.validateApiKey(headers);
    const blogId = apiKey.blog.id;
    return await this.mcpService.updatePost(id, updateData, blogId);
  }

  /**
   * 포스트 삭제
   */
  @Delete('posts/:id')
  async deletePost(@Param('id') id: string, @Headers() headers) {
    const apiKey = await this.validateApiKey(headers);
    const blogId = apiKey.blog.id;
    await this.mcpService.deletePost(id, blogId);
    return { message: '포스트가 삭제되었습니다.' };
  }

  /**
   * 블로그 정보 조회
   */
  @Get('blog')
  async getBlogInfo(@Headers() headers) {
    const apiKey = await this.validateApiKey(headers);
    const blog = apiKey.blog;
    return {
      id: blog.id,
      slug: blog.slug,
      name: blog.name,
      description: blog.description,
    };
  }

  /**
   * API 상태 확인
   */
  @Get('status')
  async getStatus(@Headers() headers) {
    const apiKey = await this.validateApiKey(headers);
    return {
      status: 'ok',
      blog: apiKey.blog.slug,
      user: apiKey.user.email,
      timestamp: new Date().toISOString(),
    };
  }
}