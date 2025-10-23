/**
 * Prometheus 메트릭 서비스 - MCP Proxy 성능 모니터링
 *
 * 수집 메트릭:
 * - API Key 검증 시간 (캐시 히트/미스별)
 * - 캐시 히트율
 * - 요청 처리 시간
 * - 에러율
 */

import { Registry, Counter, Histogram, Gauge } from 'prom-client';
import { logger } from '../utils/logger.js';

export class MetricsService {
  private registry: Registry;

  // 카운터
  private cacheHitsCounter: Counter;
  private cacheMissesCounter: Counter;
  private requestsCounter: Counter;
  private errorsCounter: Counter;

  // 히스토그램 (분포 측정)
  private validationDuration: Histogram;
  private requestDuration: Histogram;
  private redisOperationDuration: Histogram;

  // 게이지 (현재 값)
  private redisConnectionGauge: Gauge;

  // Redis 작업 카운터
  private redisOperationsCounter: Counter;

  constructor() {
    // Registry 생성 (메트릭 저장소)
    this.registry = new Registry();

    // 기본 메트릭 추가 (CPU, 메모리 등)
    this.registry.setDefaultLabels({
      app: 'mcp-proxy-server',
    });

    // ===== 카운터 =====

    // API Key 캐시 히트
    this.cacheHitsCounter = new Counter({
      name: 'mcp_api_key_cache_hits_total',
      help: 'Total number of API key cache hits',
      registers: [this.registry],
    });

    // API Key 캐시 미스
    this.cacheMissesCounter = new Counter({
      name: 'mcp_api_key_cache_misses_total',
      help: 'Total number of API key cache misses',
      registers: [this.registry],
    });

    // 전체 요청 수
    this.requestsCounter = new Counter({
      name: 'mcp_requests_total',
      help: 'Total number of MCP requests',
      labelNames: ['status', 'tool'], // 성공/실패, 도구명
      registers: [this.registry],
    });

    // 에러 수
    this.errorsCounter = new Counter({
      name: 'mcp_errors_total',
      help: 'Total number of errors',
      labelNames: ['error_type', 'status_code'],
      registers: [this.registry],
    });

    // ===== 히스토그램 (P50, P95, P99) =====

    // API Key 검증 시간
    this.validationDuration = new Histogram({
      name: 'mcp_api_key_validation_duration_seconds',
      help: 'API key validation duration in seconds',
      labelNames: ['cache_hit'], // true/false
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 1ms ~ 5s
      registers: [this.registry],
    });

    // 요청 처리 시간
    this.requestDuration = new Histogram({
      name: 'mcp_request_duration_seconds',
      help: 'Request processing duration in seconds',
      labelNames: ['tool'], // 도구명
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10], // 10ms ~ 10s
      registers: [this.registry],
    });

    // Redis 작업 시간 (경량 버킷 - 5개만)
    this.redisOperationDuration = new Histogram({
      name: 'mcp_redis_operation_duration_seconds',
      help: 'Redis operation duration in seconds',
      labelNames: ['operation'], // get, set, del
      buckets: [0.001, 0.01, 0.1, 0.5, 1], // 1ms, 10ms, 100ms, 500ms, 1s
      registers: [this.registry],
    });

    // ===== 게이지 (현재 값) =====

    // Redis 연결 상태
    this.redisConnectionGauge = new Gauge({
      name: 'mcp_redis_connection_status',
      help: 'Redis connection status (1 = connected, 0 = disconnected)',
      registers: [this.registry],
    });

    // Redis 작업 카운터 (경량 - operation과 status만 추적)
    this.redisOperationsCounter = new Counter({
      name: 'mcp_redis_operations_total',
      help: 'Total number of Redis operations',
      labelNames: ['operation', 'status'], // get/set/del, success/error
      registers: [this.registry],
    });

    logger.info('✅ Prometheus metrics initialized');
  }

  /**
   * 캐시 히트 기록
   */
  recordCacheHit(): void {
    this.cacheHitsCounter.inc();
  }

  /**
   * 캐시 미스 기록
   */
  recordCacheMiss(): void {
    this.cacheMissesCounter.inc();
  }

  /**
   * API Key 검증 시간 기록
   *
   * @param durationMs 검증 시간 (밀리초)
   * @param cacheHit 캐시 히트 여부
   */
  recordValidationDuration(durationMs: number, cacheHit: boolean): void {
    this.validationDuration.observe(
      { cache_hit: cacheHit ? 'true' : 'false' },
      durationMs / 1000 // 초 단위로 변환
    );
  }

  /**
   * 요청 처리 시간 기록
   *
   * @param durationMs 처리 시간 (밀리초)
   * @param tool 도구명 (check_auth, get_writing_style_guide, create_post)
   */
  recordRequestDuration(durationMs: number, tool?: string): void {
    this.requestDuration.observe(
      { tool: tool || 'unknown' },
      durationMs / 1000
    );
  }

  /**
   * 요청 수 기록
   *
   * @param status 상태 (success, error)
   * @param tool 도구명
   */
  recordRequest(status: 'success' | 'error', tool?: string): void {
    this.requestsCounter.inc({
      status,
      tool: tool || 'unknown',
    });
  }

  /**
   * 에러 기록
   *
   * @param errorType 에러 타입 (validation_failed, backend_error, timeout 등)
   * @param statusCode HTTP 상태 코드
   */
  recordError(errorType: string, statusCode: number): void {
    this.errorsCounter.inc({
      error_type: errorType,
      status_code: statusCode.toString(),
    });
  }

  /**
   * Redis 연결 상태 업데이트
   *
   * @param connected 연결 상태 (true = 1, false = 0)
   */
  updateRedisConnection(connected: boolean): void {
    this.redisConnectionGauge.set(connected ? 1 : 0);
  }

  /**
   * Redis 작업 기록 (경량 구현)
   *
   * @param operation Redis 작업 유형 (get, set, del)
   * @param durationMs 작업 시간 (밀리초)
   * @param success 성공 여부
   */
  recordRedisOperation(
    operation: 'get' | 'set' | 'del',
    durationMs: number,
    success: boolean
  ): void {
    // 작업 시간 기록 (히스토그램)
    this.redisOperationDuration.observe(
      { operation },
      durationMs / 1000 // 초 단위로 변환
    );

    // 작업 카운터 증가
    this.redisOperationsCounter.inc({
      operation,
      status: success ? 'success' : 'error',
    });
  }

  /**
   * Prometheus 메트릭 출력 (GET /metrics용)
   *
   * @returns Prometheus 형식 문자열
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * 메트릭 통계 조회 (디버그용)
   */
  async getStats(): Promise<{
    cacheHits: number;
    cacheMisses: number;
    cacheHitRate: number;
    totalRequests: number;
    totalErrors: number;
  }> {
    try {
      // 메트릭에서 값 추출
      const metrics = await this.registry.getMetricsAsJSON();

      const cacheHitsMetric = metrics.find((m) => m.name === 'mcp_api_key_cache_hits_total');
      const cacheMissesMetric = metrics.find((m) => m.name === 'mcp_api_key_cache_misses_total');
      const requestsMetric = metrics.find((m) => m.name === 'mcp_requests_total');
      const errorsMetric = metrics.find((m) => m.name === 'mcp_errors_total');

      const cacheHits = cacheHitsMetric?.values[0]?.value || 0;
      const cacheMisses = cacheMissesMetric?.values[0]?.value || 0;
      const totalCacheRequests = cacheHits + cacheMisses;
      const cacheHitRate = totalCacheRequests > 0 ? (cacheHits / totalCacheRequests) * 100 : 0;

      const totalRequests = requestsMetric?.values.reduce((sum, v) => sum + (v.value || 0), 0) || 0;
      const totalErrors = errorsMetric?.values.reduce((sum, v) => sum + (v.value || 0), 0) || 0;

      return {
        cacheHits,
        cacheMisses,
        cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
        totalRequests,
        totalErrors,
      };
    } catch (error: any) {
      logger.error({ error: error.message }, '❌ Failed to get metrics stats');
      return {
        cacheHits: 0,
        cacheMisses: 0,
        cacheHitRate: 0,
        totalRequests: 0,
        totalErrors: 0,
      };
    }
  }
}
