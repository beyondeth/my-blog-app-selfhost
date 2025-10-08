/**
 * 좋아요 배치 처리 설정
 * Chat 모듈의 BatchConfig 패턴을 재사용
 */

export interface LikeBatchConfig {
  batchSize: number;             // 한번에 처리할 최대 요청 수
  batchInterval: number;         // 배치 처리 주기 (ms)
  maxRetries: number;            // 최대 재시도 횟수
  retryDelay: number;            // 재시도 지연 시간 (ms)
  dlqEnabled: boolean;           // Dead Letter Queue 사용 여부
  enableMonitoring: boolean;     // 모니터링 활성화
  shards: number;                // 샤드 개수 (부하 분산)
}

/**
 * 기본 설정값
 * - Chat 시스템보다 더 빠른 처리를 위해 500ms 간격 사용
 * - 좋아요는 실시간성이 중요하므로 빠른 응답 필요
 */
export const DEFAULT_LIKE_BATCH_CONFIG: LikeBatchConfig = {
  batchSize: 100,                // 최대 100개씩 처리
  batchInterval: 500,            // 500ms마다 확인 (Chat: 5000ms)
  maxRetries: 3,                 // 최대 3회 재시도
  retryDelay: 1000,              // 1초 후 재시도
  dlqEnabled: true,              // DLQ 활성화
  enableMonitoring: true,        // 모니터링 활성화
  shards: 4,                     // 4개 샤드로 부하 분산
};
