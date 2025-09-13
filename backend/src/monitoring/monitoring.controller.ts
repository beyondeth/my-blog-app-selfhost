import { 
  Controller, 
  Get, 
  Post,
  Put, 
  Query, 
  Param, 
  Body, 
  UseGuards,
  ParseIntPipe,
  ParseUUIDPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { McpTrackingService } from '../mcp/mcp-tracking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('monitoring')
@Controller('monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class MonitoringController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly mcpTrackingService: McpTrackingService,
  ) {}

  @Get('suspicious-requests')
  @ApiOperation({ summary: '의심스러운 요청 목록 조회 (관리자 전용)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 항목 수 (최대 50)' })
  @ApiQuery({ name: 'requestType', required: false, type: String, description: '요청 유형' })
  @ApiQuery({ name: 'severity', required: false, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'WARNING'] })
  @ApiQuery({ name: 'ipAddress', required: false, type: String, description: 'IP 주소' })
  @ApiQuery({ name: 'isResolved', required: false, type: Boolean, description: '해결 여부' })
  @ApiQuery({ name: 'startDate', required: false, type: Date, description: '시작 날짜' })
  @ApiQuery({ name: 'endDate', required: false, type: Date, description: '종료 날짜' })
  @ApiResponse({ status: 200, description: '의심스러운 요청 목록' })
  async getSuspiciousRequests(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('requestType') requestType?: string,
    @Query('severity') severity?: string,
    @Query('ipAddress') ipAddress?: string,
    @Query('isResolved') isResolved?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const safeLimit = Math.min(limit, 50); // 관리자도 최대 50개

    return this.monitoringService.getSuspiciousRequests({
      page,
      limit: safeLimit,
      requestType,
      severity,
      ipAddress,
      isResolved: isResolved === 'true' ? true : isResolved === 'false' ? false : undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  }

  @Get('statistics')
  @ApiOperation({ summary: '모니터링 통계 조회 (관리자 전용)' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: '통계 기간 (시간 단위, 기본 24시간)' })
  @ApiResponse({ status: 200, description: '모니터링 통계' })
  async getStatistics(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    const safeHours = Math.min(hours, 168); // 최대 1주일
    return this.monitoringService.getStatistics(safeHours);
  }

  @Put('suspicious-requests/:id/resolve')
  @ApiOperation({ summary: '의심스러운 요청 해결 처리 (관리자 전용)' })
  @ApiResponse({ status: 200, description: '해결 처리 완료' })
  async resolveRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('note') note: string,
    @Body('action') action?: 'resolved' | 'unresolved',
  ) {
    const isResolved = action === 'resolved' || action === undefined;
    await this.monitoringService.resolveRequest(id, note, isResolved);
    return { message: '처리가 완료되었습니다.' };
  }

  @Get('dashboard')
  @ApiOperation({ summary: '관리자 대시보드 데이터 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '대시보드 데이터',
    schema: {
      type: 'object',
      properties: {
        totalRequests: { type: 'number', description: '전체 요청 수' },
        unresolvedCount: { type: 'number', description: '미해결 요청 수' },
        todayCount: { type: 'number', description: '오늘 요청 수' },
        criticalCount: { type: 'number', description: 'Critical 요청 수' },
        highCount: { type: 'number', description: 'High 요청 수' },
        mediumCount: { type: 'number', description: 'Medium 요청 수' },
        lowCount: { type: 'number', description: 'Low 요청 수' },
        topIPs: { type: 'array', description: '상위 IP 주소 목록' },
        topEndpoints: { type: 'array', description: '상위 엔드포인트 목록' },
      },
    },
  })
  async getDashboard() {
    const statistics = await this.monitoringService.getStatistics(24);
    
    return {
      totalRequests: statistics.totalRequests || 0,
      unresolvedCount: statistics.unresolvedCount || 0,
      todayCount: statistics.todayCount || 0,
      criticalCount: statistics.severityCounts?.CRITICAL || 0,
      highCount: statistics.severityCounts?.HIGH || 0,
      mediumCount: statistics.severityCounts?.MEDIUM || 0,
      lowCount: statistics.severityCounts?.LOW || 0,
      topIPs: statistics.topIPs || [],
      topEndpoints: statistics.topEndpoints || [],
    };
  }

  @Get('mcp/stats')
  @ApiOperation({ summary: 'MCP 활동 통계 조회 (관리자 전용)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '통계 기간 (일 단위, 기본 7일)' })
  @ApiResponse({ 
    status: 200, 
    description: 'MCP 활동 통계',
    schema: {
      type: 'object',
      properties: {
        totalActions: { type: 'number', description: '전체 액션 수' },
        uniqueUsers: { type: 'number', description: '고유 사용자 수' },
        actionBreakdown: { 
          type: 'object',
          properties: {
            read: { type: 'number' },
            write: { type: 'number' },
            search: { type: 'number' },
          }
        },
        clientBreakdown: { 
          type: 'object',
          description: 'AI 클라이언트별 사용 통계',
          additionalProperties: { type: 'number' }
        },
        popularResources: { 
          type: 'array',
          description: '인기 리소스 목록',
          items: {
            type: 'object',
            properties: {
              resourceSlug: { type: 'string' },
              accessCount: { type: 'number' },
            }
          }
        },
      },
    },
  })
  async getMcpStats(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    const safeDays = Math.min(days, 30); // 최대 30일
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - safeDays);
    const endDate = new Date();

    const stats = await this.mcpTrackingService.getStats(startDate, endDate);

    // Transform to match frontend expectations
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStats = await this.mcpTrackingService.getStats(todayStart, endDate);

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekStats = await this.mcpTrackingService.getStats(weekStart, endDate);

    return {
      totalActivities: stats.totalActions,
      todayCount: todayStats.totalActions,
      weekCount: weekStats.totalActions,
      uniqueUsers: stats.uniqueUsers,
      byClient: stats.clientBreakdown,
      byAction: stats.actionBreakdown,
      popularResources: stats.popularResources,
    };
  }

  @Get('mcp/stats/by-client')
  @ApiOperation({ summary: 'AI 클라이언트별 MCP 활동 통계' })
  @ApiQuery({ name: 'clientType', required: true, type: String, description: 'AI 클라이언트 타입 (claude, chatgpt, gemini, qwen, unknown)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '통계 기간 (일 단위, 기본 7일)' })
  @ApiResponse({ 
    status: 200, 
    description: '특정 AI 클라이언트 활동 통계',
  })
  async getMcpStatsByClient(
    @Query('clientType') clientType: string,
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
  ) {
    const safeDays = Math.min(days, 30); // 최대 30일
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - safeDays);
    const endDate = new Date();

    return this.mcpTrackingService.getStatsByClient(clientType, startDate, endDate);
  }

  @Get('mcp/popular-posts')
  @ApiOperation({ summary: 'MCP를 통해 가장 많이 접근한 포스트 목록' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '통계 기간 (일 단위, 기본 7일)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '목록 개수 (기본 10, 최대 50)' })
  @ApiResponse({
    status: 200,
    description: '인기 포스트 목록',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          postSlug: { type: 'string' },
          accessCount: { type: 'number' },
          uniqueUsers: { type: 'number' },
        }
      }
    },
  })
  async getMcpPopularPosts(
    @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const safeDays = Math.min(days, 30);
    const safeLimit = Math.min(limit, 50);
    return this.mcpTrackingService.getPopularPosts(safeDays, safeLimit);
  }

  @Get('mcp/hourly-activity')
  @ApiOperation({ summary: 'MCP 시간대별 활동 패턴' })
  @ApiQuery({ name: 'hours', required: false, type: Number, description: '분석 기간 (시간 단위, 기본 24시간)' })
  @ApiResponse({
    status: 200,
    description: '시간대별 활동 패턴',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          hour: { type: 'number', description: '시간 (0-23)' },
          clientType: { type: 'string', description: 'AI 클라이언트 타입' },
          count: { type: 'number', description: '활동 수' },
        }
      }
    },
  })
  async getMcpHourlyActivity(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    const days = Math.ceil(hours / 24);
    const safeDays = Math.min(days, 30);
    return this.mcpTrackingService.getHourlyActivity(safeDays);
  }

  @Get('mcp/user-activity/:userId')
  @ApiOperation({ summary: '특정 사용자의 MCP 활동 내역' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: '조회 기간 (일 단위, 기본 30일)' })
  @ApiResponse({ 
    status: 200, 
    description: '사용자 활동 내역',
  })
  async getMcpUserActivity(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ) {
    const safeDays = Math.min(days, 90);
    return this.mcpTrackingService.getUserActivity(userId, safeDays);
  }

  @Post('mcp/clean-logs')
  @ApiOperation({ summary: 'MCP 로그 정리 (관리자 전용)' })
  @ApiQuery({ name: 'daysToKeep', required: false, type: Number, description: '보관 기간 (일 단위, 기본 90일)' })
  @ApiResponse({ 
    status: 200, 
    description: '로그 정리 결과',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number', description: '삭제된 로그 수' },
      }
    },
  })
  async cleanMcpLogs(
    @Query('daysToKeep', new DefaultValuePipe(90), ParseIntPipe) daysToKeep: number,
  ) {
    const safeDays = Math.max(daysToKeep, 30); // 최소 30일 보관
    const deletedCount = await this.mcpTrackingService.cleanOldLogs(safeDays);
    return { deletedCount };
  }
}