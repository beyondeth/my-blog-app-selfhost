/**
 * Post Processing Queue 정의
 *
 * Fast Path 이후 백그라운드 처리를 위한 BullMQ Queue
 * - Content 처리 (HTML sanitization, code highlighting)
 * - File link 처리 (S3 key 추출, FileContext 업데이트)
 * - Search vector 생성
 * - 처리 완료 후 status를 'published' 또는 'failed'로 변경
 *
 * 배포 구조:
 * - Backend (3000) ← Worker 실행
 * - MCP Proxy (3002) ← Job 생성
 * - Shared Redis ← Queue 데이터 저장 (분산 인스턴스 간 공유)
 */

import { Queue, QueueOptions } from 'bullmq';
import Redis from 'ioredis';

/**
 * Job 데이터 타입 정의
 */
export interface PostProcessingJobData {
  postId: string; // 처리할 포스트 ID
  userId: string; // 작성자 ID (권한 확인용)
  blogId: string; // 블로그 ID
  title: string; // 제목
  content: string; // 원본 Markdown 컨텐츠
  tags?: string[]; // 태그 목록
  category?: string; // 카테고리
}

/**
 * Job 처리 결과 타입
 */
export interface PostProcessingResult {
  success: boolean;
  postId: string;
  status: 'published' | 'failed';
  error?: string;
  processingTime: number; // 처리 시간 (ms)
}

/**
 * Queue 이름 상수
 */
export const POST_PROCESSING_QUEUE = 'post-processing';

/**
 * Redis 연결 옵션
 * 환경변수에서 읽어오며, 분산 배포를 위해 공유 Redis 사용
 */
export const getRedisConnection = (): Redis => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3, // 최대 재시도 횟수
    enableReadyCheck: true,
    retryStrategy: (times) => {
      // 지수 백오프: 1초, 2초, 4초, 8초...
      const delay = Math.min(times * 1000, 10000);
      return delay;
    },
  });
};

/**
 * BullMQ Queue 옵션
 */
export const queueOptions: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3, // 실패 시 최대 3번 재시도
    backoff: {
      type: 'exponential',
      delay: 2000, // 첫 재시도: 2초, 두 번째: 4초, 세 번째: 8초
    },
    removeOnComplete: {
      age: 86400, // 24시간 후 완료된 Job 자동 삭제
      count: 1000, // 최대 1000개까지 보관
    },
    removeOnFail: {
      age: 604800, // 7일 후 실패한 Job 자동 삭제
      count: 5000, // 최대 5000개까지 보관 (디버깅용)
    },
    // timeout은 Worker 설정에서 지정 (post-processing.processor.ts의 WorkerOptions 참조)
  },
};

/**
 * Post Processing Queue 인스턴스 생성
 *
 * 사용 예시:
 * ```typescript
 * // Job 추가
 * await postProcessingQueue.add('process-post', jobData);
 *
 * // Job 상태 조회
 * const job = await postProcessingQueue.getJob(jobId);
 * const state = await job.getState();
 * ```
 */
export const postProcessingQueue = new Queue<PostProcessingJobData>(
  POST_PROCESSING_QUEUE,
  queueOptions,
);

/**
 * Queue 정리 및 종료
 * 애플리케이션 종료 시 호출
 */
export const closeQueue = async () => {
  await postProcessingQueue.close();
};
