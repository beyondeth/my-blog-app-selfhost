/**
 * 메트릭 모듈
 * @description Prometheus 메트릭 수집을 위한 모듈
 * 채팅 큐 시스템의 성능 및 상태 모니터링
 */

import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';
import { ChatMetricsService } from './chat-metrics.service';
import { LikeMetricsService } from './like-metrics.service';
import { AdminMetricsController } from './admin-metrics.controller';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    PrometheusModule.register({
      // Prometheus가 메트릭을 수집할 엔드포인트 (환경변수로 설정)
      path: process.env.METRICS_PATH || '/internal/health-check-2f4a8b9c',
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
  controllers: [AdminMetricsController],
  providers: [MetricsService, ChatMetricsService, LikeMetricsService],
  exports: [MetricsService, ChatMetricsService, LikeMetricsService],
})
export class MetricsModule {}