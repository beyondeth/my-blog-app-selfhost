import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { McpAuthGuard } from '../../mcp/mcp-auth.guard';
import { McpRateLimitService } from '../../mcp/mcp-rate-limit.service';

@ApiTags('Admin - Nonce Management')
@Controller('admin/nonce')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminNonceController {
  constructor(
    private readonly mcpAuthGuard: McpAuthGuard,
    private readonly rateLimitService: McpRateLimitService,
  ) {}

  /**
   * 논스 관리 통계 조회
   */
  @Get('stats')
  @ApiOperation({ summary: '논스 관리 통계' })
  @ApiResponse({
    status: 200,
    description: '논스 통계 정보',
    schema: {
      type: 'object',
      properties: {
        nonce: {
          type: 'object',
          properties: {
            activeNonces: { type: 'number', description: '현재 활성 논스 개수' },
            totalMemoryUsage: { type: 'string', description: '논스 메모리 사용량' },
            hitRate: { type: 'number', description: '캐시 히트율' },
          },
        },
        rateLimit: {
          type: 'object',
          properties: {
            activeRateLimits: { type: 'number', description: '활성 Rate Limit 규칙 수' },
            blockedIPs: { type: 'number', description: '차단된 IP 개수' },
            topIPs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ip: { type: 'string' },
                  requests: { type: 'number' },
                },
              },
            },
          },
        },
        systemInfo: {
          type: 'object',
          properties: {
            redisConnected: { type: 'boolean', description: 'Redis 연결 상태' },
            cacheType: { type: 'string', description: '캐시 타입 (redis/memory)' },
            uptime: { type: 'number', description: '서버 업타임 (초)' },
          },
        },
      },
    },
  })
  async getNonceStats() {
    try {
      const [nonceStats, rateLimitStats] = await Promise.all([
        this.mcpAuthGuard.getNonceStats(),
        this.rateLimitService.getRateLimitStats(),
      ]);

      return {
        success: true,
        data: {
          nonce: nonceStats,
          rateLimit: rateLimitStats,
          systemInfo: {
            redisConnected: true, // TODO: 실제 Redis 연결 상태 확인
            cacheType: nonceStats.totalMemoryUsage !== 'Unknown' ? 'redis' : 'memory',
            uptime: Math.floor(process.uptime()),
          },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'NONCE_STATS_ERROR',
          message: '논스 통계 조회 실패',
          details: error.message,
        },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * MCP Rate Limiting 설정 조회
   */
  @Get('config')
  @ApiOperation({ summary: 'MCP Rate Limiting 설정' })
  @ApiResponse({
    status: 200,
    description: 'Rate Limiting 설정 정보',
    schema: {
      type: 'object',
      properties: {
        limits: {
          type: 'object',
          properties: {
            perMinute: { type: 'number', description: '분당 요청 제한' },
            perHour: { type: 'number', description: '시간당 요청 제한' },
            perDay: { type: 'number', description: '일일 요청 제한' },
            blockDuration: { type: 'number', description: '차단 지속 시간 (초)' },
          },
        },
        security: {
          type: 'object',
          properties: {
            nonceExpiry: { type: 'number', description: '논스 만료 시간 (초)' },
            timestampWindow: { type: 'number', description: '타임스탬프 윈도우 (밀리초)' },
          },
        },
      },
    },
  })
  async getRateLimitConfig() {
    return {
      success: true,
      data: {
        limits: {
          perMinute: 3,
          perHour: 10,
          perDay: 10,
          blockDuration: 300, // 5분
        },
        security: {
          nonceExpiry: 300, // 5분
          timestampWindow: 300000, // 5분
        },
        description: {
          perMinute: 'MCP 자동포스팅 특화 제한 (분당 3개 포스트)',
          perHour: '시간당 최대 포스팅 수',
          perDay: '일일 최대 포스팅 수 (무료 플랜)',
          blockDuration: '연속 실패 시 차단 시간',
        },
      },
      timestamp: new Date().toISOString(),
    };
  }
}