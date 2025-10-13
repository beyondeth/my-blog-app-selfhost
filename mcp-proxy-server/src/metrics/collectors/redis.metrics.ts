/**
 * Redis Metrics Collector
 *
 * Redis 작업 관련 메트릭 수집 헬퍼 함수
 * - SessionService에서 사용
 * - Redis 작업 성능 및 안정성 추적
 */

import {
  redisOperationsTotal,
  redisOperationDuration,
  redisConnected,
} from '../prometheus.js';

/**
 * Redis 작업 타입
 */
export type RedisOperation = 'get' | 'set' | 'del' | 'scan' | 'incr' | 'decr' | 'expire' | 'ttl';

/**
 * Redis 작업 상태
 */
export type RedisOperationStatus = 'success' | 'error';

/**
 * Redis 작업 메트릭 기록
 *
 * @param operation - Redis 작업 타입
 * @param status - 작업 결과 ('success' | 'error')
 */
export function recordRedisOperation(operation: RedisOperation, status: RedisOperationStatus): void {
  redisOperationsTotal.inc({ operation, status });
}

/**
 * Redis 작업 처리 시간 기록
 *
 * @param operation - Redis 작업 타입
 * @param durationMs - 작업 처리 시간 (밀리초)
 */
export function recordRedisOperationDuration(operation: RedisOperation, durationMs: number): void {
  const durationSeconds = durationMs / 1000;
  redisOperationDuration.observe({ operation }, durationSeconds);
}

/**
 * Redis 연결 상태 업데이트
 *
 * @param connected - 연결 상태 (true = 연결됨, false = 끊김)
 */
export function updateRedisConnectionStatus(connected: boolean): void {
  redisConnected.set(connected ? 1 : 0);
}

/**
 * Redis 작업 타이머 (편의 함수)
 *
 * 사용 예시:
 * ```typescript
 * const timer = startRedisOperationTimer('get');
 * try {
 *   const result = await redis.get(key);
 *   timer.recordSuccess();
 *   return result;
 * } catch (error) {
 *   timer.recordError();
 *   throw error;
 * }
 * ```
 */
export interface RedisOperationTimer {
  /**
   * 작업 성공 기록
   */
  recordSuccess(): void;

  /**
   * 작업 실패 기록
   */
  recordError(): void;
}

/**
 * Redis 작업 타이머 시작
 *
 * @param operation - Redis 작업 타입
 * @returns 타이머 객체 (recordSuccess, recordError 메서드 제공)
 */
export function startRedisOperationTimer(operation: RedisOperation): RedisOperationTimer {
  const startTime = Date.now();

  return {
    recordSuccess(): void {
      const duration = Date.now() - startTime;
      recordRedisOperation(operation, 'success');
      recordRedisOperationDuration(operation, duration);
    },

    recordError(): void {
      const duration = Date.now() - startTime;
      recordRedisOperation(operation, 'error');
      recordRedisOperationDuration(operation, duration);
    },
  };
}

/**
 * Redis 작업 래퍼 (async/await 지원)
 *
 * 사용 예시:
 * ```typescript
 * const result = await withRedisMetrics('get', async () => {
 *   return await redis.get(key);
 * });
 * ```
 *
 * @param operation - Redis 작업 타입
 * @param fn - 실행할 Redis 작업 함수
 * @returns Redis 작업 결과
 */
export async function withRedisMetrics<T>(
  operation: RedisOperation,
  fn: () => Promise<T>
): Promise<T> {
  const timer = startRedisOperationTimer(operation);

  try {
    const result = await fn();
    timer.recordSuccess();
    return result;
  } catch (error) {
    timer.recordError();
    throw error;
  }
}
