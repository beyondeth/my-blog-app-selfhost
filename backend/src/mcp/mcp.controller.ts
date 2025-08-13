import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UseInterceptors, Request, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { McpService } from './mcp.service';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { UpdatePostDto } from '../posts/dto/update-post.dto';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { AuthService } from '../auth/auth.service';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpRateLimitGuard } from './mcp-rate-limit.guard';
import { McpLoggingInterceptor } from './mcp-logging.interceptor';

@Controller('mcp')
@Public() // Bypass JWT auth, we'll use API key auth instead
@UseInterceptors(McpLoggingInterceptor) // Log all MCP requests
@UseGuards(McpRateLimitGuard) // Apply rate limiting to all endpoints
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly apiKeysService: ApiKeysService,
    private readonly authService: AuthService,
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

    // Log MCP API usage
    this.logger.log(`MCP API request from blog: ${validation.apiKey.blog.slug}, user: ${validation.apiKey.user.email}`);

    return validation.apiKey;
  }

  /**
   * MCP 2단계 인증 엔드포인트
   * 1차: 사용자 로그인 확인
   * 2차: API 키 확인
   */
  @Post('auth/verify')
  async verifyMcpAuth(
    @Body() body: { email: string; password: string },
    @Headers() headers,
  ) {
    try {
      // Step 1: Verify user credentials
      const user = await this.authService.validateUser(body.email, body.password);
      if (!user) {
        this.logger.warn(`MCP auth failed: Invalid credentials for ${body.email}`);
        throw new UnauthorizedException('사용자 인증에 실패했습니다.');
      }

      // Step 2: Verify API key
      const apiKey = headers['x-api-key'] || headers['authorization']?.replace('Bearer ', '');
      if (!apiKey) {
        this.logger.warn(`MCP auth failed: No API key provided for ${body.email}`);
        throw new UnauthorizedException('API 키가 필요합니다.');
      }

      const validation = await this.apiKeysService.validateApiKey(apiKey);
      if (!validation.valid) {
        this.logger.warn(`MCP auth failed: Invalid API key for ${body.email}`);
        throw new UnauthorizedException('유효하지 않은 API 키입니다.');
      }

      // Step 3: Verify API key belongs to the authenticated user
      if (validation.apiKey.userId !== user.id) {
        this.logger.warn(`MCP auth failed: API key mismatch for ${body.email}`);
        throw new UnauthorizedException('API 키가 사용자와 일치하지 않습니다.');
      }

      // Success: Log and return auth status
      this.logger.log(`MCP auth successful for ${body.email}, blog: ${validation.apiKey.blog.slug}`);
      
      return {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
        },
        blog: {
          id: validation.apiKey.blog.id,
          slug: validation.apiKey.blog.slug,
          name: validation.apiKey.blog.name,
        },
        apiKey: {
          id: validation.apiKey.id,
          name: validation.apiKey.name,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`MCP auth error: ${error.message}`);
      throw new UnauthorizedException('인증 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 포스트 생성
   */
  @Post('posts')
  @UseGuards(McpAuthGuard)
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
  @UseGuards(McpAuthGuard)
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
  @UseGuards(McpAuthGuard)
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
  @UseGuards(McpAuthGuard)
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
  @UseGuards(McpAuthGuard)
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
  @UseGuards(McpAuthGuard)
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