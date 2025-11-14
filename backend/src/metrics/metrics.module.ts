/**
 * 메트릭 모듈
 * @description Prometheus 메트릭 수집을 위한 모듈
 * 채팅 큐 시스템의 성능 및 상태 모니터링
 */

import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { ChatMetricsService } from './chat-metrics.service';
import { CacheMetricsService } from './cache-metrics.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { MetricsController } from './metrics.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrometheusModule.register({
      // PrometheusModule의 자동 엔드포인트 비활성화 (커스텀 컨트롤러 사용)
      path: null,
      // 기본 Node.js 메트릭 활성화
      defaultMetrics: {
        enabled: true,
        config: {
          prefix: 'nodejs_',
        },
      },
      // 글로벌 레이블 설정
      defaultLabels: {
        app: 'chat-queue-system',
        version: '1.0.0',
      },
    }),
    RedisModule,
  ],
  controllers: [MetricsController, AdminMetricsController],
  providers: [MetricsService, ChatMetricsService, CacheMetricsService],
  exports: [MetricsService, ChatMetricsService, CacheMetricsService],
})
export class MetricsModule {}