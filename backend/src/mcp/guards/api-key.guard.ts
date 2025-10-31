import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { McpApiKeyService } from '../services/mcp-api-key.service';

/**
 * API Key 인증 가드
 *
 * MCP Proxy Server에서 오는 요청을 API Key로 인증합니다.
 *
 * 흐름:
 * 1. X-API-Key 헤더에서 API Key 추출
 * 2. McpApiKeyService.validateKey()로 검증
 * 3. request.apiKey에 사용자/블로그 정보 첨부
 *
 * 사용 예:
 * @UseGuards(ApiKeyGuard)
 * async createPost(@Req() req: any) {
 *   const { userId, blogId, keyId } = req.apiKey;
 * }
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(private readonly mcpApiKeyService: McpApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // 1. X-API-Key 헤더 추출
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      this.logger.warn('Missing X-API-Key header');
      throw new UnauthorizedException('API Key required in X-API-Key header');
    }

    try {
      // 2. API Key 검증
      const mcpApiKey = await this.mcpApiKeyService.validateKey(apiKey);

      // 3. 시간별 카운터 증가 (비동기, 블로킹 없음)
      this.mcpApiKeyService.incrementHourlyCounter().catch(err => {
        this.logger.error('Failed to increment hourly counter:', err);
      });

      // 4. request에 인증 정보 첨부 (컨트롤러에서 사용)
      request.apiKey = {
        keyId: mcpApiKey.id,
        userId: mcpApiKey.userId,
        blogId: mcpApiKey.blogId,
        user: {
          id: mcpApiKey.user.id,
          username: mcpApiKey.user.username,
          email: mcpApiKey.user.email,
        },
        blog: {
          id: mcpApiKey.blog.id,
          name: mcpApiKey.blog.name,
          slug: mcpApiKey.blog.alias || mcpApiKey.blog.slug, // Phase 2: alias 우선
        },
      };

      this.logger.debug(`✅ API Key validated: user=${mcpApiKey.userId.substring(0, 8)}, blog=${mcpApiKey.blog.alias || mcpApiKey.blog.slug}`);
      return true;
    } catch (error: any) {
      this.logger.warn(`❌ API Key validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired API Key');
    }
  }
}
