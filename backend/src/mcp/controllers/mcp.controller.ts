import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { McpApiKeyService } from '../services/mcp-api-key.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Public } from '../../common/decorators/public.decorator';
import { CreateMcpApiKeyDto } from '../dto/create-mcp-api-key.dto';
import { ValidateMcpApiKeyDto } from '../dto/validate-mcp-api-key.dto';
import { UsageService } from '../../usage/usage.service';
import { ResourceType } from '../../common/enums/subscription.enum';

/**
 * MCP API Key 관리 컨트롤러
 *
 * 엔드포인트:
 * - POST /api/v1/mcp/keys: API Key 생성 (사용자당 1개)
 * - GET /api/v1/mcp/keys: 내 API Key 목록
 * - DELETE /api/v1/mcp/keys/:id: API Key 삭제
 * - POST /api/v1/mcp/validate-key: API Key 검증 (MCP Proxy → Backend)
 */
@Controller('mcp')
export class McpController {
  constructor(
    private readonly mcpApiKeyService: McpApiKeyService,
    private readonly usageService: UsageService,
  ) {}

  /**
   * API Key 생성
   *
   * @param req JWT 인증된 요청 (user 정보 포함)
   * @param dto { blogId, name }
   * @returns { apiKey: 전체 키 (1회만 표시), keyHint, expiresAt }
   *
   * 정책:
   * - 사용자당 1개 제한 (기존 키 자동 삭제)
   * - 생성된 API Key는 1회만 표시됨 (재조회 불가)
   */
  @Post('keys')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createKey(@Request() req: any, @Body() dto: CreateMcpApiKeyDto) {
    const userId = req.user.id;

    const result = await this.mcpApiKeyService.create(
      userId,
      dto.blogId,
      dto.name,
    );

    return {
      message: 'API Key created successfully. Save this key - it will not be shown again.',
      data: result,
    };
  }

  /**
   * 내 API Key 목록 조회
   *
   * @param req JWT 인증된 요청
   * @returns API Key 목록 (secret 제외, hint만 표시)
   */
  @Get('keys')
  @UseGuards(JwtAuthGuard)
  async listKeys(@Request() req: any) {
    const userId = req.user.id;

    const keys = await this.mcpApiKeyService.findByUser(userId);

    // Secret 제외하고 반환 (keyHint만 표시)
    const sanitizedKeys = keys.map((key) => ({
      id: key.id,
      keyHint: key.keyHint,
      name: key.name,
      blogId: key.blogId,
      blogName: key.blog.name,
      isActive: key.isActive,
      requestCount: key.requestCount,
      postsCreated: key.postsCreated,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      lastUsedAt: key.lastUsedAt,
    }));

    return {
      data: sanitizedKeys,
    };
  }

  /**
   * API Key 삭제
   *
   * @param req JWT 인증된 요청
   * @param id API Key ID
   */
  @Delete('keys/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteKey(@Request() req: any, @Param('id') id: string) {
    const userId = req.user.id;

    await this.mcpApiKeyService.delete(id, userId);

    return;
  }

  /**
   * API Key 검증 (MCP Proxy Server → Backend)
   *
   * @param dto { apiKey }
   * @returns { userId, blogId, user, blog }
   *
   * 용도:
   * - MCP Proxy Server가 API Key를 검증하기 위해 호출
   * - VPC Internal Network에서만 접근 가능 (보안)
   *
   * 주의:
   * - 이 엔드포인트는 JWT 인증 없음 (API Key 자체가 인증)
   * - Rate Limiting 필요 (향후 추가)
   */
  @Post('validate-key')
  @Public()
  @HttpCode(HttpStatus.OK)
  async validateKey(@Body() dto: ValidateMcpApiKeyDto) {
    const mcpApiKey = await this.mcpApiKeyService.validateKey(dto.apiKey);

    return {
      valid: true,
      data: {
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
          slug: mcpApiKey.blog.slug,
        },
      },
    };
  }

  /**
   * 포스트 생성 카운트 증가 (MCP Proxy → Backend)
   *
   * @param id API Key ID
   *
   * 용도:
   * - create_post 성공 시 MCP Proxy가 호출
   * - VPC Internal Network에서만 접근 가능
   */
  @Post('keys/:id/increment-posts')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  async incrementPosts(@Param('id') id: string) {
    await this.mcpApiKeyService.incrementPostsCreated(id);
    return;
  }

  // ============================================================
  // 관리자 전용 통계 API
  // ============================================================

  /**
   * 총 MCP 사용량 통계 (관리자 전용)
   *
   * @returns 전체 시스템의 MCP 사용량 통계
   */
  @Get('admin/stats/total')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getTotalStats() {
    const stats = await this.mcpApiKeyService.getTotalStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 월별 MCP 사용량 통계 (관리자 전용)
   *
   * @param year 연도 (예: 2025)
   * @param month 월 (1-12)
   * @returns 특정 월의 MCP 사용량 통계
   */
  @Get('admin/stats/monthly/:year/:month')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getMonthlyStats(
    @Param('year', ParseIntPipe) year: number,
    @Param('month', ParseIntPipe) month: number,
  ) {
    const stats = await this.mcpApiKeyService.getMonthlyStats(year, month);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 사용자별 MCP 통계 (관리자 전용)
   *
   * @param limit 조회할 사용자 수 (기본: 20)
   * @returns 사용량 순위별 사용자 통계
   */
  @Get('admin/stats/users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getUserStats(@Query('limit') limit?: number) {
    const stats = await this.mcpApiKeyService.getUserStats(limit || 20);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 시간별 MCP 사용량 (관리자 전용)
   *
   * @param hours 조회할 시간 범위 (기본: 24시간)
   * @returns 시간별 MCP 사용량
   */
  @Get('admin/stats/hourly')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getHourlyStats(@Query('hours') hours?: number) {
    const stats = await this.mcpApiKeyService.getHourlyStats(hours || 24);
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * 최근 MCP 활동 로그 (관리자 전용)
   *
   * @param limit 조회할 로그 수 (기본: 50)
   * @returns 최근 MCP 포스트 생성 이력
   */
  @Get('admin/logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async getRecentLogs(@Query('limit') limit?: number) {
    // 모든 사용자의 MCP_POST 사용 이력 조회
    const logs = await this.usageService.getUsageHistory(
      null, // 모든 사용자
      ResourceType.MCP_POST,
      null, // 시작 날짜
      null, // 종료 날짜
    );

    return {
      success: true,
      data: logs.slice(0, limit || 50),
    };
  }
}
