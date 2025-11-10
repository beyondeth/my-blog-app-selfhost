/**
 * 관리자용 메트릭 컨트롤러
 * @description 관리자가 브라우저에서 메트릭을 확인할 수 있는 보안 엔드포인트
 * JWT 인증과 ADMIN 권한이 필요함
 */

import {
  Controller,
  Get,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { ChatMetricsService } from './chat-metrics.service';
import { RedisMonitoringService } from '../redis/redis-monitoring.service';
import { register } from 'prom-client';

@ApiTags('admin')
@Controller('admin/monitoring')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth('JWT-auth')
export class AdminMetricsController {
  constructor(
    private readonly chatMetricsService: ChatMetricsService,
    private readonly redisMonitoringService: RedisMonitoringService,
  ) {}

  /**
   * 캐시 메트릭 미리보기 (Grafana 연동 전 테스트용)
   * @returns 현재 등록된 모든 캐시 메트릭 목록
   */
  @Get('cache-metrics-preview')
  @ApiOperation({
    summary: '캐시 메트릭 미리보기',
    description: 'Grafana 연동 전 Prometheus 형식의 캐시 메트릭 확인'
  })
  async getCacheMetricsPreview(): Promise<string[]> {
    const metricsText = await register.metrics();
    const lines = metricsText.split('\n');

    // cache_ 로 시작하는 메트릭만 필터링
    return lines.filter(line =>
      line.includes('cache_') && !line.startsWith('#')
    );
  }

  /**
   * 관리자용 메트릭 대시보드 데이터
   * @returns 포맷된 메트릭 정보 (JSON)
   */
  @Get('dashboard')
  @ApiOperation({
    summary: '메트릭 대시보드 데이터 조회',
    description: '관리자용 포맷된 메트릭 정보를 JSON으로 반환'
  })
  @ApiResponse({
    status: 200,
    description: '메트릭 데이터',
    schema: {
      type: 'object',
      properties: {
        chatQueue: {
          type: 'object',
          properties: {
            queueSize: { type: 'number' },
            dlqSize: { type: 'number' },
            processingStatus: { type: 'string' },
            consecutiveFailures: { type: 'number' },
          }
        },
        redis: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            memoryUsage: { type: 'string' },
            totalKeys: { type: 'number' },
          }
        },
        system: {
          type: 'object',
          properties: {
            uptime: { type: 'number' },
            memoryUsage: { type: 'object' },
            cpuUsage: { type: 'object' },
          }
        },
      }
    }
  })
  async getMetricsDashboard() {
    try {
      // Redis 정보 조회
      const redisInfo = await this.redisMonitoringService.getRedisInfo();
      const redisConnected = await this.redisMonitoringService.isConnected();

      // Prometheus 메트릭 조회
      const metricsText = await register.metrics();

      // 메트릭 파싱 및 포맷팅
      const metrics = this.parseMetrics(metricsText);

      return {
        timestamp: new Date().toISOString(),
        chatQueue: {
          queueSize: metrics['chat_queue_size'] || 0,
          dlqSize: metrics['chat_dlq_size'] || 0,
          processingStatus: metrics['chat_processing_status'] === 1 ? 'Processing' : 'Idle',
          consecutiveFailures: metrics['chat_consecutive_failures'] || 0,
          messagesProcessed: metrics['chat_messages_processed_total'] || 0,
          messagesFailed: metrics['chat_messages_failed_total'] || 0,
          redisConnectionStatus: metrics['chat_redis_connection_status'] === 1 ? 'Connected' : 'Disconnected',
          activeWebSocketConnections: metrics['chat_websocket_connections_active'] || 0,
        },
        redis: {
          connected: redisConnected,
          memoryUsage: redisInfo.usedMemoryHuman,
          memoryPeak: redisInfo.usedMemoryPeakHuman,
          totalKeys: redisInfo.totalKeys,
          connectedClients: redisInfo.connectedClients,
          uptime: redisInfo.uptime,
        },
        system: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
        },
      };
    } catch (error) {
      throw new HttpException(
        'Failed to retrieve metrics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 원본 Prometheus 메트릭 텍스트 조회
   * @returns Prometheus 형식의 메트릭 텍스트
   */
  @Get('raw')
  @ApiOperation({
    summary: '원본 Prometheus 메트릭 조회',
    description: '관리자용 원본 Prometheus 형식의 메트릭 텍스트 반환'
  })
  @ApiResponse({
    status: 200,
    description: 'Prometheus 메트릭 텍스트',
    type: String,
  })
  async getRawMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * 메트릭 텍스트를 파싱하여 객체로 변환
   * @param metricsText Prometheus 메트릭 텍스트
   * @returns 파싱된 메트릭 객체
   */
  private parseMetrics(metricsText: string): Record<string, number> {
    const metrics: Record<string, number> = {};
    const lines = metricsText.split('\n');

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)\{?[^}]*\}?\s+(.+)$/);
        if (match) {
          const [, name, value] = match;
          // 간단한 파싱 - 더 복잡한 경우 별도 파서 필요
          const cleanName = name.split('{')[0];
          if (!metrics[cleanName] || cleanName.startsWith('chat_')) {
            metrics[cleanName] = parseFloat(value) || 0;
          }
        }
      }
    }

    return metrics;
  }
}