/**
 * 좋아요 큐 시스템 인터페이스
 * Chat 모듈의 MessageQueue 패턴을 재사용
 */

/**
 * 큐에 저장되는 좋아요 요청 데이터
 */
export interface QueuedLike {
  id: string;                    // 고유 ID (UUID)
  postId: string;                // 포스트 ID
  userId: string;                // 사용자 ID
  action: 'like' | 'unlike';     // 좋아요/취소
  queuedAt: Date;                // 큐 추가 시각
  retryCount: number;            // 재시도 횟수
}

/**
 * Redis에 저장되는 좋아요 데이터 (직렬화용)
 */
export interface RedisLikeData {
  id: string;
  postId: string;
  userId: string;
  action: 'like' | 'unlike';
  queuedAt: string;              // ISO string
}

/**
 * 배치 처리 결과
 */
export interface LikeBatchResult {
  success: boolean;
  processedCount: number;        // 성공한 요청 수
  failedCount: number;           // 실패한 요청 수
  processingTime: number;        // 처리 시간 (ms)
  failedLikes?: QueuedLike[];    // 실패한 요청들
  error?: string;                // 에러 메시지
}

/**
 * 큐 메트릭
 */
export interface LikeQueueMetrics {
  queueSize: number;             // 현재 큐 크기
  dlqSize: number;               // Dead Letter Queue 크기
  processingRate: number;        // 초당 처리량
  averageProcessingTime: number; // 평균 처리 시간 (ms)
  lastProcessedAt?: Date;        // 마지막 처리 시각
  failureRate: number;           // 실패율 (0.0 ~ 1.0)
}
