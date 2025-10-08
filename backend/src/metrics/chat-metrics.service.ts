/**
 * 채팅 메트릭 서비스
 * @description 채팅 큐 시스템 전용 메트릭 관리
 */

import { Injectable } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  register,
} from 'prom-client';

@Injectable()
export class ChatMetricsService {
  // 큐 크기 게이지 (현재 큐에 있는 메시지 수)
  public readonly queueSize: Gauge<string>;

  // DLQ 크기 게이지 (Dead Letter Queue의 메시지 수)
  public readonly dlqSize: Gauge<string>;

  // 처리된 메시지 카운터
  public readonly messagesProcessed: Counter<string>;

  // 실패한 메시지 카운터
  public readonly messagesFailed: Counter<string>;

  // 배치 처리 시간 히스토그램
  public readonly batchProcessingDuration: Histogram<string>;

  // 메시지 처리 지연 시간 히스토그램
  public readonly messageLatency: Histogram<string>;

  // 연속 실패 횟수 게이지
  public readonly consecutiveFailures: Gauge<string>;

  // 현재 처리 상태 게이지 (0: idle, 1: processing)
  public readonly processingStatus: Gauge<string>;

  // Redis 연결 상태 (0: disconnected, 1: connected)
  public readonly redisConnectionStatus: Gauge<string>;

  // 활성 WebSocket 연결 수
  public readonly activeWebSocketConnections: Gauge<string>;

  constructor() {
    // 큐 크기 메트릭
    this.queueSize = new Gauge({
      name: 'chat_queue_size',
      help: '현재 처리 대기중인 메시지 수',
      labelNames: ['queue_type'],
      registers: [register],
    });

    // DLQ 크기 메트릭
    this.dlqSize = new Gauge({
      name: 'chat_dlq_size',
      help: 'Dead Letter Queue에 있는 메시지 수',
      registers: [register],
    });

    // 처리된 메시지 수
    this.messagesProcessed = new Counter({
      name: 'chat_messages_processed_total',
      help: '성공적으로 처리된 총 메시지 수',
      labelNames: ['status', 'conversation_id'],
      registers: [register],
    });

    // 실패한 메시지 수
    this.messagesFailed = new Counter({
      name: 'chat_messages_failed_total',
      help: '처리 실패한 총 메시지 수',
      labelNames: ['error_type'],
      registers: [register],
    });

    // 배치 처리 시간
    this.batchProcessingDuration = new Histogram({
      name: 'chat_batch_duration_seconds',
      help: '배치 처리에 걸린 시간 (초)',
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      labelNames: ['batch_size'],
      registers: [register],
    });

    // 메시지 지연 시간
    this.messageLatency = new Histogram({
      name: 'chat_message_latency_seconds',
      help: '메시지가 큐에서 대기한 시간 (초)',
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [register],
    });

    // 연속 실패 횟수
    this.consecutiveFailures = new Gauge({
      name: 'chat_consecutive_failures',
      help: '연속으로 실패한 배치 처리 횟수',
      registers: [register],
    });

    // 처리 상태
    this.processingStatus = new Gauge({
      name: 'chat_processing_status',
      help: '현재 배치 처리 상태 (0: idle, 1: processing)',
      registers: [register],
    });

    // Redis 연결 상태
    this.redisConnectionStatus = new Gauge({
      name: 'chat_redis_connection_status',
      help: 'Redis 연결 상태 (0: disconnected, 1: connected)',
      registers: [register],
    });

    // WebSocket 연결 수
    this.activeWebSocketConnections = new Gauge({
      name: 'chat_websocket_connections_active',
      help: '현재 활성 WebSocket 연결 수',
      registers: [register],
    });

    // 초기값 설정
    this.initializeMetrics();
  }

  /**
   * 메트릭 초기화
   */
  private initializeMetrics() {
    this.queueSize.set({ queue_type: 'main' }, 0);
    this.dlqSize.set(0);
    this.consecutiveFailures.set(0);
    this.processingStatus.set(0);
    this.redisConnectionStatus.set(0);
    this.activeWebSocketConnections.set(0);

    // Counter 메트릭 초기화 (Prometheus에 즉시 노출하기 위해)
    // 초기값 0으로 설정하여 Grafana에서 "No data" 방지
    this.messagesProcessed.inc({ status: 'success' }, 0);
    this.messagesFailed.inc({ error_type: 'batch_save' }, 0);
  }

  /**
   * 큐 메트릭 업데이트
   */
  updateQueueMetrics(queueSize: number, dlqSize: number) {
    this.queueSize.set({ queue_type: 'main' }, queueSize);
    this.dlqSize.set(dlqSize);
  }

  /**
   * 배치 처리 시작
   */
  startBatchProcessing() {
    this.processingStatus.set(1);
  }

  /**
   * 배치 처리 완료
   */
  endBatchProcessing(
    duration: number,
    processedCount: number,
    failedCount: number,
    batchSize: number,
  ) {
    this.processingStatus.set(0);

    // 처리 시간 기록
    this.batchProcessingDuration.observe(
      { batch_size: batchSize.toString() },
      duration / 1000,
    );

    // 처리된 메시지 수 증가
    if (processedCount > 0) {
      this.messagesProcessed.inc({ status: 'success' }, processedCount);
    }

    // 실패한 메시지 수 증가
    if (failedCount > 0) {
      this.messagesFailed.inc({ error_type: 'batch_save' }, failedCount);
    }
  }

  /**
   * 메시지 지연 시간 기록
   */
  recordMessageLatency(latencyMs: number) {
    this.messageLatency.observe(latencyMs / 1000);
  }

  /**
   * 연속 실패 횟수 업데이트
   */
  updateConsecutiveFailures(count: number) {
    this.consecutiveFailures.set(count);
  }

  /**
   * Redis 연결 상태 업데이트
   */
  updateRedisConnectionStatus(connected: boolean) {
    this.redisConnectionStatus.set(connected ? 1 : 0);
  }

  /**
   * WebSocket 연결 수 업데이트
   */
  updateWebSocketConnections(count: number) {
    this.activeWebSocketConnections.set(count);
  }

  /**
   * WebSocket 연결 증가
   */
  incrementWebSocketConnections() {
    this.activeWebSocketConnections.inc();
  }

  /**
   * WebSocket 연결 감소
   */
  decrementWebSocketConnections() {
    this.activeWebSocketConnections.dec();
  }
}