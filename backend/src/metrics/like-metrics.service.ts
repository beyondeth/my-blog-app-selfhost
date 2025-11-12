/**
 * 좋아요 큐 메트릭 서비스
 * @description 좋아요 큐 시스템 전용 Prometheus 메트릭 관리
 * Chat 큐 시스템(ChatMetricsService)의 패턴을 그대로 적용
 */

import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  register,
} from 'prom-client';

@Injectable()
export class LikeMetricsService {
  // ========================================
  // Gauge 메트릭 (현재 값을 측정)
  // ========================================

  /**
   * 큐 크기 게이지
   * 현재 처리 대기중인 좋아요 요청 수
   * 샤드별로 라벨링하여 부하 분산 상태 모니터링
   */
  public readonly queueSize: Gauge<string>;

  /**
   * Dead Letter Queue 크기 게이지
   * 처리 실패하여 DLQ로 이동된 좋아요 요청 수
   */
  public readonly dlqSize: Gauge<string>;

  /**
   * 연속 실패 횟수 게이지
   * 배치 처리가 연속으로 실패한 횟수 (장애 감지용)
   */
  public readonly consecutiveFailures: Gauge<string>;

  /**
   * 현재 처리 상태 게이지
   * 0: 대기중 (idle)
   * 1: 처리중 (processing)
   */
  public readonly processingStatus: Gauge<string>;

  /**
   * Redis 연결 상태 게이지
   * 0: 연결 끊김 (disconnected)
   * 1: 연결됨 (connected)
   */
  public readonly redisConnectionStatus: Gauge<string>;

  // ========================================
  // Counter 메트릭 (누적 값을 측정)
  // ========================================

  /**
   * 처리된 좋아요 카운터
   * 성공적으로 처리된 총 좋아요 요청 수
   * status 라벨: success, failed
   */
  public readonly likesProcessed: Counter<string>;

  /**
   * 실패한 좋아요 카운터
   * 처리 실패한 총 좋아요 요청 수
   * error_type 라벨: batch_save, database_error 등
   */
  public readonly likesFailed: Counter<string>;

  /**
   * FK 위반 카운터
   * 유효하지 않은 postId로 인한 FK 제약 조건 위반 횟수
   */
  public readonly foreignKeyViolations: Counter<string>;

  // ========================================
  // Histogram 메트릭 (분포를 측정)
  // ========================================

  /**
   * 배치 처리 시간 히스토그램
   * 배치 처리에 걸린 시간 (초 단위)
   * buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
   */
  public readonly batchProcessingDuration: Histogram<string>;

  /**
   * 좋아요 지연 시간 히스토그램
   * 좋아요 요청이 큐에서 대기한 시간 (초 단위)
   * buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
   */
  public readonly likeLatency: Histogram<string>;

  constructor() {
    // ========================================
    // Gauge 메트릭 초기화
    // ========================================

    this.queueSize = new Gauge({
      name: 'likes_queue_size',
      help: '현재 처리 대기중인 좋아요 요청 수',
      labelNames: ['shard'],
      registers: [register],
    });

    this.dlqSize = new Gauge({
      name: 'likes_dlq_size',
      help: 'Dead Letter Queue에 있는 좋아요 요청 수',
      registers: [register],
    });

    this.consecutiveFailures = new Gauge({
      name: 'likes_consecutive_failures',
      help: '연속으로 실패한 배치 처리 횟수',
      registers: [register],
    });

    this.processingStatus = new Gauge({
      name: 'likes_processing_status',
      help: '현재 배치 처리 상태 (0: idle, 1: processing)',
      registers: [register],
    });

    this.redisConnectionStatus = new Gauge({
      name: 'likes_redis_connection_status',
      help: 'Redis 연결 상태 (0: disconnected, 1: connected)',
      registers: [register],
    });

    // ========================================
    // Counter 메트릭 초기화
    // ========================================

    this.likesProcessed = new Counter({
      name: 'likes_processed_total',
      help: '성공적으로 처리된 총 좋아요 요청 수',
      labelNames: ['status'],
      registers: [register],
    });

    this.likesFailed = new Counter({
      name: 'likes_failed_total',
      help: '처리 실패한 총 좋아요 요청 수',
      labelNames: ['error_type'],
      registers: [register],
    });

    this.foreignKeyViolations = new Counter({
      name: 'likes_foreign_key_violations_total',
      help: '유효하지 않은 postId로 인한 FK 제약 조건 위반 횟수',
      registers: [register],
    });

    // ========================================
    // Histogram 메트릭 초기화
    // ========================================

    this.batchProcessingDuration = new Histogram({
      name: 'likes_batch_duration_seconds',
      help: '배치 처리에 걸린 시간 (초)',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      labelNames: ['batch_size'],
      registers: [register],
    });

    this.likeLatency = new Histogram({
      name: 'likes_latency_seconds',
      help: '좋아요 요청이 큐에서 대기한 시간 (초)',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [register],
    });

    // 초기값 설정
    this.initializeMetrics();
  }

  /**
   * 메트릭 초기화
   * 서비스 시작 시 모든 메트릭을 0으로 설정
   */
  private initializeMetrics() {
    // 샤드별 큐 크기 초기화 (4개 샤드)
    for (let i = 0; i < 4; i++) {
      this.queueSize.set({ shard: i.toString() }, 0);
    }

    this.dlqSize.set(0);
    this.consecutiveFailures.set(0);
    this.processingStatus.set(0);
    this.redisConnectionStatus.set(0);

    // Counter 메트릭 초기화 (Prometheus에 즉시 노출하기 위해)
    // 초기값 0으로 설정하여 Grafana에서 "No data" 방지
    this.likesProcessed.inc({ status: 'success' }, 0);
    this.likesFailed.inc({ error_type: 'batch_save' }, 0);
  }

  // ========================================
  // 메트릭 업데이트 메서드
  // ========================================

  /**
   * 큐 메트릭 업데이트
   * 배치 처리 전후로 호출하여 큐 상태 갱신
   *
   * @param queueSize - 전체 큐 크기
   * @param dlqSize - DLQ 크기
   */
  updateQueueMetrics(queueSize: number, dlqSize: number) {
    // 전체 큐 크기를 shard=total로 저장
    this.queueSize.set({ shard: 'total' }, queueSize);
    this.dlqSize.set(dlqSize);
  }

  /**
   * 샤드별 큐 크기 업데이트
   * 부하 분산 상태 모니터링용
   *
   * @param shardSizes - 샤드별 큐 크기 배열 [shard0, shard1, shard2, shard3]
   */
  updateShardQueueMetrics(shardSizes: number[]) {
    shardSizes.forEach((size, index) => {
      this.queueSize.set({ shard: index.toString() }, size);
    });
  }

  /**
   * 배치 처리 시작
   * processingStatus를 1(processing)로 설정
   */
  startBatchProcessing() {
    this.processingStatus.set(1);
  }

  /**
   * 배치 처리 완료
   * 처리 시간, 성공/실패 카운트, 배치 크기를 메트릭에 기록
   *
   * @param duration - 처리 시간 (밀리초)
   * @param processedCount - 성공 처리된 좋아요 수
   * @param failedCount - 실패한 좋아요 수
   * @param batchSize - 배치 크기
   */
  endBatchProcessing(
    duration: number,
    processedCount: number,
    failedCount: number,
    batchSize: number,
  ) {
    // 처리 상태를 0(idle)로 변경
    this.processingStatus.set(0);

    // 처리 시간 기록 (밀리초 → 초)
    this.batchProcessingDuration.observe(
      { batch_size: batchSize.toString() },
      duration / 1000,
    );

    // 성공 카운트 증가
    if (processedCount > 0) {
      this.likesProcessed.inc({ status: 'success' }, processedCount);
    }

    // 실패 카운트 증가
    if (failedCount > 0) {
      this.likesFailed.inc({ error_type: 'batch_save' }, failedCount);
    }
  }

  /**
   * 좋아요 지연 시간 기록
   * 큐에서 대기한 시간을 히스토그램에 기록
   *
   * @param latencyMs - 지연 시간 (밀리초)
   */
  recordLikeLatency(latencyMs: number) {
    this.likeLatency.observe(latencyMs / 1000);
  }

  /**
   * 연속 실패 횟수 업데이트
   * 장애 감지 및 알람 트리거용
   *
   * @param count - 연속 실패 횟수
   */
  updateConsecutiveFailures(count: number) {
    this.consecutiveFailures.set(count);
  }

  /**
   * Redis 연결 상태 업데이트
   * 연결 상태 모니터링용
   *
   * @param connected - 연결 여부 (true: 1, false: 0)
   */
  updateRedisConnectionStatus(connected: boolean) {
    this.redisConnectionStatus.set(connected ? 1 : 0);
  }

  /**
   * FK 위반 횟수 기록
   * 유효하지 않은 postId로 인한 FK 제약 조건 위반 모니터링용
   *
   * @param count - FK 위반 횟수
   */
  recordForeignKeyViolation(count: number) {
    this.foreignKeyViolations.inc(count);
  }
}
