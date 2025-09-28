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

  // MCP 트래킹 관련 엔드포인트 제거됨 - 나중에 재구현 예정
  // TODO: MCP tracking을 다시 구현할 때 OAuth2 기반으로 추가

}