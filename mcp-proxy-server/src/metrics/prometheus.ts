/**
 * Prometheus Metrics 레지스트리
 *
 * MCP Proxy Server의 모든 메트릭을 중앙에서 관리
 * - HTTP 요청/응답 메트릭
 * - 세션 관리 메트릭
 * - Redis 작업 메트릭
 * - 비즈니스 로직 메트릭
 * - 에러 추적 메트릭
 */

import client from 'prom-client';
import { logger } from '../utils/logger.js';

// 기본 메트릭 수집기 (CPU, 메모리, 이벤트 루프 등)
client.collectDefaultMetrics({
  prefix: 'mcp_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5], // GC 지속 시간 버킷
});

/**
 * HTTP 요청 메트릭
 */

// HTTP 요청 총 개수
export const httpRequestsTotal = new client.Counter({
  name: 'mcp_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
});

// HTTP 요청 처리 시간 (히스토그램)
export const httpRequestDuration = new client.Histogram({
  name: 'mcp_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5, 10], // 1ms ~ 10s
});

// HTTP 요청 크기 (바이트)
export const httpRequestSize = new client.Histogram({
  name: 'mcp_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'path'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000], // 100B ~ 10MB
});

// HTTP 응답 크기 (바이트)
export const httpResponseSize = new client.Histogram({
  name: 'mcp_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000], // 100B ~ 10MB
});

/**
 * 세션 메트릭
 */

// 현재 활성 세션 수 (Gauge - 증감 가능)
export const sessionsActive = new client.Gauge({
  name: 'mcp_sessions_active',
  help: 'Number of currently active sessions',
});

// 세션 생성 총 개수
export const sessionsCreatedTotal = new client.Counter({
  name: 'mcp_sessions_created_total',
  help: 'Total number of sessions created',
});

// 세션 삭제 총 개수
export const sessionsDeletedTotal = new client.Counter({
  name: 'mcp_sessions_deleted_total',
  help: 'Total number of sessions deleted',
  labelNames: ['reason'], // manual, timeout
});

// 세션 수명 (히스토그램)
export const sessionLifetime = new client.Histogram({
  name: 'mcp_session_lifetime_seconds',
  help: 'Session lifetime in seconds',
  buckets: [60, 300, 600, 1800, 3600, 7200, 14400], // 1분 ~ 4시간
});

// Transport 생성 총 개수
export const transportsCreatedTotal = new client.Counter({
  name: 'mcp_transports_created_total',
  help: 'Total number of transports created',
});

// Transport 생성 실패 개수
export const transportsCreationFailedTotal = new client.Counter({
  name: 'mcp_transports_creation_failed_total',
  help: 'Total number of transport creation failures',
  labelNames: ['reason'], // max_sessions, error
});

/**
 * Redis 메트릭
 */

// Redis 작업 총 개수
export const redisOperationsTotal = new client.Counter({
  name: 'mcp_redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'], // get, set, del / success, error
});

// Redis 작업 처리 시간 (히스토그램)
export const redisOperationDuration = new client.Histogram({
  name: 'mcp_redis_operation_duration_seconds',
  help: 'Redis operation duration in seconds',
  labelNames: ['operation'], // get, set, del, scan
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1], // 1ms ~ 1s
});

// Redis 연결 상태 (Gauge: 1=연결됨, 0=끊김)
export const redisConnected = new client.Gauge({
  name: 'mcp_redis_connected',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
});

/**
 * 비즈니스 메트릭
 */

// 인증 시도 총 개수
export const authAttemptsTotal = new client.Counter({
  name: 'mcp_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status'], // success, failure
});

// 포스트 생성 총 개수
export const postsCreatedTotal = new client.Counter({
  name: 'mcp_posts_created_total',
  help: 'Total number of posts created',
  labelNames: ['status'], // success, failure
});

// Backend API 호출 총 개수
export const backendRequestsTotal = new client.Counter({
  name: 'mcp_backend_requests_total',
  help: 'Total number of backend API requests',
  labelNames: ['endpoint', 'method', 'status_code'],
});

// Backend API 호출 처리 시간 (히스토그램)
export const backendRequestDuration = new client.Histogram({
  name: 'mcp_backend_request_duration_seconds',
  help: 'Backend API request duration in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30], // 10ms ~ 30s
});

/**
 * 에러 메트릭
 */

// 에러 총 개수
export const errorsTotal = new client.Counter({
  name: 'mcp_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_code', 'status_code'], // Error code from ErrorCodes constant, HTTP status code
});

// Rate Limit 초과 횟수
export const rateLimitExceededTotal = new client.Counter({
  name: 'mcp_rate_limit_exceeded_total',
  help: 'Total number of rate limit exceeded events',
  labelNames: ['endpoint'],
});

/**
 * 커스텀 메트릭 등록
 */

// 최대 동시 세션 수 (피크 값 추적)
export const sessionsPeak = new client.Gauge({
  name: 'mcp_sessions_peak',
  help: 'Peak number of concurrent sessions',
});

// 평균 세션 수명 (Gauge - 계산된 값)
export const sessionsAverageLifetime = new client.Gauge({
  name: 'mcp_sessions_average_lifetime_seconds',
  help: 'Average session lifetime in seconds',
});

/**
 * 메트릭 레지스트리 (모든 메트릭의 중앙 저장소)
 */
export const register = client.register;

/**
 * 메트릭 초기화 (서버 시작 시 호출)
 */
export function initializeMetrics(): void {
  logger.info('✅ Prometheus metrics initialized');
  logger.info(`📊 Metrics endpoint: GET /metrics`);

  // Redis 연결 상태 초기화
  redisConnected.set(0);
}

/**
 * 메트릭 내보내기 (GET /metrics 엔드포인트용)
 */
export async function getMetrics(): Promise<string> {
  return await register.metrics();
}

/**
 * 특정 메트릭 초기화 (테스트용)
 */
export function resetMetrics(): void {
  register.resetMetrics();
  logger.info('🔄 Prometheus metrics reset');
}
