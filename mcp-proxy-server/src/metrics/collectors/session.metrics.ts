/**
 * Session Metrics Collector
 *
 * 세션 및 Transport 관련 메트릭 수집 헬퍼 함수
 * - SessionService와 TransportManager에서 사용
 * - 메트릭 수집 로직을 중앙화하여 일관성 유지
 */

import {
  sessionsActive,
  sessionsCreatedTotal,
  sessionsDeletedTotal,
  sessionLifetime,
  sessionsPeak,
  sessionsAverageLifetime,
  transportsCreatedTotal,
  transportsCreationFailedTotal,
  authAttemptsTotal,
} from '../prometheus.js';

/**
 * 세션 생성 메트릭 기록
 */
export function recordSessionCreated(): void {
  sessionsCreatedTotal.inc();
}

/**
 * 세션 삭제 메트릭 기록
 *
 * @param reason - 삭제 이유 ('manual' | 'timeout')
 * @param lifetimeMs - 세션 수명 (밀리초)
 */
export function recordSessionDeleted(reason: 'manual' | 'timeout', lifetimeMs: number): void {
  sessionsDeletedTotal.inc({ reason });

  // 세션 수명을 초 단위로 기록
  const lifetimeSeconds = lifetimeMs / 1000;
  sessionLifetime.observe(lifetimeSeconds);
}

/**
 * 현재 활성 세션 수 업데이트
 *
 * @param count - 현재 활성 세션 수
 */
export function updateActiveSessions(count: number): void {
  sessionsActive.set(count);
}

/**
 * 피크 세션 수 업데이트
 *
 * @param count - 현재까지 최대 동시 세션 수
 */
export function updatePeakSessions(count: number): void {
  sessionsPeak.set(count);
}

/**
 * 평균 세션 수명 업데이트
 *
 * @param averageLifetimeMs - 평균 세션 수명 (밀리초)
 */
export function updateAverageSessionLifetime(averageLifetimeMs: number): void {
  const averageLifetimeSeconds = averageLifetimeMs / 1000;
  sessionsAverageLifetime.set(averageLifetimeSeconds);
}

/**
 * Transport 생성 성공 메트릭 기록
 */
export function recordTransportCreated(): void {
  transportsCreatedTotal.inc();
}

/**
 * Transport 생성 실패 메트릭 기록
 *
 * @param reason - 실패 이유 ('max_sessions' | 'error')
 */
export function recordTransportCreationFailed(reason: 'max_sessions' | 'error'): void {
  transportsCreationFailedTotal.inc({ reason });
}

/**
 * 인증 시도 메트릭 기록
 *
 * @param status - 인증 결과 ('success' | 'failure')
 */
export function recordAuthAttempt(status: 'success' | 'failure'): void {
  authAttemptsTotal.inc({ status });
}

/**
 * 세션 메트릭 일괄 업데이트
 *
 * SessionService와 TransportManager에서 호출하여
 * 여러 메트릭을 한 번에 업데이트
 *
 * @param metrics - 업데이트할 메트릭 정보
 */
export interface SessionMetricsUpdate {
  active: number;
  peak: number;
  averageLifetime: number; // milliseconds
}

export function updateSessionMetrics(metrics: SessionMetricsUpdate): void {
  updateActiveSessions(metrics.active);
  updatePeakSessions(metrics.peak);
  updateAverageSessionLifetime(metrics.averageLifetime);
}
