import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { McpApiKeyService } from "../services/mcp-api-key.service";
import { UsersService } from "../../users/users.service";
import { BlogsService } from "../../blogs/blogs.service";
import { ConfigService } from "@nestjs/config";
import { assertInternalMcpSecret } from "../../common/guards/internal-mcp.guard";

/**
 * API Key / OAuth 인증 가드
 *
 * MCP Proxy Server에서 오는 요청을 인증합니다.
 *
 * 지원하는 인증 방식:
 * 1. API Key 모드: X-API-Key 헤더 (기존 방식)
 * 2. OAuth 모드: X-OAuth-User-Id, X-OAuth-Blog-Id 헤더 (Claude 커스텀 커넥터)
 *
 * OAuth 모드는 MCP Proxy에서 이미 토큰을 검증한 후
 * 내부 서비스 간 통신으로 사용자 정보를 전달합니다.
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

  constructor(
    private readonly mcpApiKeyService: McpApiKeyService,
    private readonly usersService: UsersService,
    private readonly blogsService: BlogsService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    assertInternalMcpSecret(request, this.configService, this.logger);

    // 1. X-API-Key 헤더 확인 (기존 API Key 인증)
    const apiKey = request.headers["x-api-key"];

    if (apiKey) {
      return this.validateApiKey(request, apiKey);
    }

    // 2. OAuth 헤더 확인 (MCP Proxy OAuth 모드)
    const oauthUserId = request.headers["x-oauth-user-id"];
    const oauthBlogId = request.headers["x-oauth-blog-id"];

    if (oauthUserId && oauthBlogId) {
      return this.validateOAuthHeaders(request, oauthUserId, oauthBlogId);
    }

    // 인증 헤더 없음
    this.logger.warn("Missing authentication headers (X-API-Key or X-OAuth-*)");
    throw new UnauthorizedException(
      "Authentication required: API Key or OAuth headers",
    );
  }

  /**
   * API Key 인증 처리 (기존 방식)
   */
  private async validateApiKey(request: any, apiKey: string): Promise<boolean> {
    try {
      const mcpApiKey = await this.mcpApiKeyService.validateKey(apiKey);

      // 시간별 카운터 증가 (비동기, 블로킹 없음)
      this.mcpApiKeyService.incrementHourlyCounter().catch((err) => {
        this.logger.error("Failed to increment hourly counter:", err);
      });

      // request에 인증 정보 첨부
      request.apiKey = {
        keyId: mcpApiKey.id,
        userId: mcpApiKey.userId,
        blogId: mcpApiKey.blogId,
        organizationId:
          mcpApiKey.organizationId || mcpApiKey.blog.organizationId,
        user: {
          id: mcpApiKey.user.id,
          username: mcpApiKey.user.username,
          email: mcpApiKey.user.email,
        },
        blog: {
          id: mcpApiKey.blog.id,
          name: mcpApiKey.blog.name,
          slug: mcpApiKey.blog.alias || mcpApiKey.blog.slug,
          isPublic: mcpApiKey.blog.isPublic,
        },
        authMode: "api_key",
      };

      this.logger.debug(
        `✅ API Key validated: user=${mcpApiKey.userId.substring(0, 8)}`,
      );
      return true;
    } catch (error: any) {
      this.logger.warn(`❌ API Key validation failed: ${error.message}`);
      throw new UnauthorizedException("Invalid or expired API Key");
    }
  }

  /**
   * OAuth 헤더 인증 처리 (MCP Proxy OAuth 모드)
   *
   * MCP Proxy에서 OAuth 토큰을 검증한 후 내부 서비스 간 통신으로
   * 사용자 ID와 블로그 ID를 전달합니다.
   * Docker 내부 네트워크에서만 접근 가능하므로 헤더 신뢰.
   */
  private async validateOAuthHeaders(
    request: any,
    userId: string,
    blogId: string,
  ): Promise<boolean> {
    try {
      // 사용자 정보 조회
      const user = await this.usersService.findOne(userId);
      if (!user) {
        this.logger.warn(`❌ OAuth user not found: ${userId.substring(0, 8)}`);
        throw new UnauthorizedException("OAuth user not found");
      }

      // 블로그 정보 조회
      const blog = await this.blogsService.findOne(blogId);
      if (!blog) {
        this.logger.warn(`❌ OAuth blog not found: ${blogId.substring(0, 8)}`);
        throw new UnauthorizedException("OAuth blog not found");
      }

      // 블로그 소유권 확인
      if (blog.userId !== userId) {
        this.logger.warn(
          `❌ Blog ownership mismatch: user=${userId.substring(0, 8)}, blog.userId=${blog.userId.substring(0, 8)}`,
        );
        throw new UnauthorizedException("Blog ownership mismatch");
      }

      // request에 인증 정보 첨부 (API Key 모드와 동일한 형식)
      request.apiKey = {
        keyId: `oauth:${userId}`,
        userId: user.id,
        blogId: blog.id,
        organizationId: blog.organizationId,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
        },
        blog: {
          id: blog.id,
          name: blog.name,
          slug: blog.alias || blog.slug,
          isPublic: blog.isPublic,
        },
        authMode: "oauth",
      };

      this.logger.debug(
        `✅ OAuth validated: user=${userId.substring(0, 8)}, blog=${blog.alias || blog.slug}`,
      );
      return true;
    } catch (error: any) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn(`❌ OAuth validation failed: ${error.message}`);
      throw new UnauthorizedException("OAuth validation failed");
    }
  }
}
