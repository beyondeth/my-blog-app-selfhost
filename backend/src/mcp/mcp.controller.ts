import { Controller, Get, Post, Body, Param, Query, UseGuards, UseInterceptors, Request, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpTrackingService } from './mcp-tracking.service';
import { CreatePostDto } from '../posts/dto/create-post.dto';
import { Public } from '../common/decorators/public.decorator';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { AuthService } from '../auth/auth.service';
import { McpAuthGuard } from './mcp-auth.guard';
import { McpRateLimitGuard } from './mcp-rate-limit.guard';
import { McpLoggingInterceptor } from './mcp-logging.interceptor';
import * as crypto from 'crypto';
import { PaginationHelper } from '../common/dto/pagination.dto';
import { MonitoringService } from '../monitoring/monitoring.service';

@Controller('mcp')
@Public() // Bypass JWT auth, we'll use API key auth instead
@UseInterceptors(McpLoggingInterceptor) // Log all MCP requests
@UseGuards(McpRateLimitGuard) // Apply rate limiting to all endpoints
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly mcpService: McpService,
    private readonly mcpTrackingService: McpTrackingService,
    private readonly apiKeysService: ApiKeysService,
    private readonly authService: AuthService,
    private readonly monitoringService: MonitoringService,
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
   * HMAC-SHA256 서명 검증 헬퍼 메서드
   */
  private verifyHmacSignature(
    method: string,
    uri: string,
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    apiKeySecret: string,
  ): boolean {
    try {
      // 1. Create Canonical Request
      const bodyHash = crypto.createHash('sha256').update(body).digest('hex');
      const canonicalRequest = `${method}\n${uri}\n${timestamp}\n${nonce}\n${bodyHash}`;
      
      // 2. Create String to Sign
      const requestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
      const stringToSign = `HMAC-SHA256\n${timestamp}\n${requestHash}`;
      
      // 3. Create signature with Secret
      const expectedSignature = crypto
        .createHmac('sha256', apiKeySecret)
        .update(stringToSign)
        .digest('hex');
      
      // 4. Compare signatures
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch (error) {
      this.logger.error(`HMAC verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * MCP HMAC 서명 기반 인증 엔드포인트
   * OAuth 사용자도 비밀번호 없이 API Key로만 인증 가능
   */
  @Post('auth/verify')
  async verifyMcpAuth(
    @Body() body: { apiKeyId: string; timestamp: string; nonce: string },
    @Headers() headers,
  ) {
    try {
      // Extract headers
      const apiKeyId = headers['x-api-key-id'];
      const signature = headers['x-api-signature'];
      const timestamp = headers['x-api-timestamp'];
      const nonce = headers['x-api-nonce'];

      if (!apiKeyId || !signature || !timestamp || !nonce) {
        this.logger.warn(`MCP auth failed: Missing required headers`);
        throw new UnauthorizedException('필수 인증 헤더가 누락되었습니다.');
      }

      // Validate timestamp (5 minute window)
      const currentTime = Date.now();
      const requestTime = parseInt(timestamp);
      if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
        this.logger.warn(`MCP auth failed: Timestamp expired for ${apiKeyId}`);
        throw new UnauthorizedException('요청 시간이 만료되었습니다.');
      }

      // Find API key by ID
      const apiKey = await this.apiKeysService.findByKeyId(apiKeyId);
      if (!apiKey) {
        this.logger.warn(`MCP auth failed: API key not found for ${apiKeyId}`);
        throw new UnauthorizedException('유효하지 않은 API 키입니다.');
      }

      // Get the API key secret (hashed version)
      const apiKeySecret = await this.apiKeysService.getApiKeySecret(apiKeyId);
      if (!apiKeySecret) {
        this.logger.warn(`MCP auth failed: API key secret not found for ${apiKeyId}`);
        throw new UnauthorizedException('API 키 시크릿을 찾을 수 없습니다.');
      }

      // Verify HMAC signature
      const method = 'POST';
      const uri = '/mcp/auth/verify';
      const bodyString = JSON.stringify(body);
      
      const isValid = this.verifyHmacSignature(
        method,
        uri,
        timestamp,
        nonce,
        bodyString,
        signature,
        apiKeySecret,
      );

      if (!isValid) {
        this.logger.warn(`MCP auth failed: Invalid signature for ${apiKeyId}`);
        throw new UnauthorizedException('서명 검증에 실패했습니다.');
      }

      // Check if API key is active
      if (!apiKey.isActive) {
        this.logger.warn(`MCP auth failed: API key inactive for ${apiKeyId}`);
        throw new UnauthorizedException('비활성화된 API 키입니다.');
      }

      // Success: Log and return auth status
      this.logger.log(`MCP auth successful for API key: ${apiKeyId}, blog: ${apiKey.blog.slug}`);
      
      return {
        valid: true,
        userId: apiKey.userId,
        blogId: apiKey.blogId,
        blog: {
          id: apiKey.blog.id,
          slug: apiKey.blog.slug,
          name: apiKey.blog.name,
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
   * 포스트 생성 (with AI tracking)
   */
  @Post('posts')
  @UseGuards(McpAuthGuard)
  async createPost(@Body() createPostDto: CreatePostDto, @Headers() headers, @Request() req) {
    const startTime = Date.now();
    // McpAuthGuard already validated and attached the info to request
    const apiKey = req.apiKey;
    const blog = req.blog;
    const user = req.user;

    // Debug logging
    if (!apiKey || !blog || !user) {
      this.logger.error('Missing required data from McpAuthGuard', {
        hasApiKey: !!apiKey,
        hasBlog: !!blog,
        hasUser: !!user,
      });
      throw new UnauthorizedException('Authentication data missing');
    }
    
    // Extract AI type from tags
    const aiTag = createPostDto.tags?.find(tag => tag.startsWith('ai:'));
    const clientType = aiTag ? aiTag.replace('ai:', '') : 'unknown';

    // Log warning if AI tag is missing
    if (!aiTag) {
      this.logger.warn(`Post created without AI identification tag by user: ${user.email}`);
    } else {
      this.logger.log(`Post created by ${clientType} AI for user: ${user.email}`);
    }

    // Create the post first to get the slug
    const createdPost = await this.mcpService.createPost(createPostDto, blog, user);

    // Log activity after post creation with slug
    await this.mcpTrackingService.logActivity({
      userId: user.id,
      apiKeyId: apiKey.id,
      actionType: 'write',
      actionCategory: 'post_creation',
      resourceType: 'post',
      resourceId: createdPost.id,
      resourceSlug: createdPost.slug,
      clientType,
      requestEndpoint: '/mcp/posts',
      requestMethod: 'POST',
      ipAddress: req.ip || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
      userAgent: headers['user-agent'],
      metadata: {
        title: createdPost.title,
        tags: createPostDto.tags,
        aiTag,
        postId: createdPost.id,
        slug: createdPost.slug,
      },
      responseTimeMs: Date.now() - startTime,
    }).catch(error => {
      // Don't fail the request if tracking fails
      this.logger.error(`Failed to log MCP activity: ${error.message}`);
    });

    return createdPost;
  }

  /**
   * 포스트 목록 조회
   */
  @Get('posts')
  @UseGuards(McpAuthGuard)
  async getPosts(
    @Request() req,
    @Headers() headers,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const apiKey = req.apiKey;
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20); // 최대 20개
    const blogId = apiKey.blog.id;
    
    // 비정상적인 요청 모니터링 및 데이터베이스 저장
    if (limit && parseInt(limit, 10) > 20) {
      const attemptedLimit = parseInt(limit, 10);
      this.logger.warn(`MCP suspicious limit request: API Key=${apiKey.keyId}, limit=${attemptedLimit}`);
      
      // 모니터링 서비스에 기록
      await this.monitoringService.logSuspiciousRequest({
        requestType: 'MCP_EXCESSIVE_LIMIT',
        ipAddress: headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
        endpoint: '/api/v1/mcp/posts',
        userId: apiKey.user.id,
        userEmail: apiKey.user.email,
        requestDetails: {
          method: 'GET',
          query: { limit: attemptedLimit },
          attemptedLimit,
          actualLimit: limitNumber,
          apiKeyId: apiKey.keyId,
        },
        reason: `MCP API attempted to request ${attemptedLimit} items (max allowed: ${limitNumber})`,
        severity: attemptedLimit > 1000 ? 'HIGH' : attemptedLimit > 100 ? 'MEDIUM' : 'LOW',
      }).catch(err => {
        this.logger.error('Failed to log MCP suspicious request:', err);
      });
    }
    
    return await this.mcpService.getPosts(blogId, pageNumber, limitNumber);
  }

  /**
   * 공개 포스트 읽기 (with tracking)
   */
  @Get('posts/read')
  @UseGuards(McpAuthGuard)
  async getReadablePosts(
    @Headers() headers,
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const startTime = Date.now();
    const apiKey = req.apiKey; // Already validated by McpAuthGuard
    const pageNumber = PaginationHelper.getSafePage(page);
    const limitNumber = PaginationHelper.getSafeLimit(limit, 20);
    
    // Extract client type from headers or default
    const clientType = headers['x-mcp-client'] || 'unknown';
    
    // Log read activity
    await this.mcpTrackingService.logActivity({
      userId: apiKey.user.id,
      apiKeyId: apiKey.id,
      actionType: search ? 'search' : 'read',
      actionCategory: 'post_list',
      resourceType: 'post',
      clientType,
      requestEndpoint: '/mcp/posts/read',
      requestMethod: 'GET',
      ipAddress: req.ip || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
      userAgent: headers['user-agent'],
      metadata: {
        page: pageNumber,
        limit: limitNumber,
        search,
      },
      responseTimeMs: Date.now() - startTime,
    });
    
    // Get public posts + user's own private posts
    return await this.mcpService.getReadablePosts(apiKey.blog.id, pageNumber, limitNumber, search);
  }

  /**
   * 특정 포스트 읽기 (with tracking)
   */
  @Get('posts/read/:slug')
  @UseGuards(McpAuthGuard)
  async readPost(
    @Param('slug') slug: string,
    @Headers() headers,
    @Request() req,
  ) {
    const startTime = Date.now();
    const apiKey = req.apiKey; // Already validated by McpAuthGuard
    
    // Extract client type
    const clientType = headers['x-mcp-client'] || 'unknown';
    
    // Log read activity
    await this.mcpTrackingService.logActivity({
      userId: apiKey.user.id,
      apiKeyId: apiKey.id,
      actionType: 'read',
      actionCategory: 'post_detail',
      resourceType: 'post',
      resourceSlug: slug,
      clientType,
      requestEndpoint: `/mcp/posts/read/${slug}`,
      requestMethod: 'GET',
      ipAddress: req.ip || headers['x-forwarded-for'] || headers['x-real-ip'] || 'unknown',
      userAgent: headers['user-agent'],
      responseTimeMs: Date.now() - startTime,
    });
    
    return await this.mcpService.getPostBySlug(slug, apiKey.blog.id);
  }

  /**
   * 블로그 정보 조회
   */
  @Get('blog')
  @UseGuards(McpAuthGuard)
  async getBlogInfo(@Request() req) {
    const apiKey = req.apiKey; // Already validated by McpAuthGuard
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
  async getStatus(@Request() req) {
    const apiKey = req.apiKey; // Already validated by McpAuthGuard
    return {
      status: 'ok',
      blog: apiKey.blog.slug,
      user: apiKey.user.email,
      timestamp: new Date().toISOString(),
    };
  }
}