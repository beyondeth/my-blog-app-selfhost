/**
 * Video Processing Queue 정의
 *
 * 비디오 업로드 후 FFmpeg 압축 처리를 위한 BullMQ Queue
 * - R2에서 원본 다운로드
 * - FFmpeg H.264 압축 (CRF 28, 720p)
 * - 압축본 R2 업로드
 * - 원본 삭제
 *
 * 배포 구조:
 * - Backend (3000) ← Worker 실행
 * - Shared Redis ← Queue 데이터 저장
 */

import { Queue, QueueOptions } from "bullmq";
import Redis from "ioredis";

/**
 * Job 데이터 타입 정의
 */
export interface VideoProcessingJobData {
  videoId: string; // Video 엔티티 ID
  userId: string; // 업로더 ID
  originalKey: string; // R2 원본 경로 (videos/raw/{uuid}.mp4)
  outputKey: string; // R2 압축본 경로 (videos/processed/{uuid}.mp4)
  originalName: string; // 원본 파일명 (로깅용)
}

/**
 * Job 처리 결과 타입
 */
export interface VideoProcessingResult {
  success: boolean;
  videoId: string;
  status: "ready" | "failed";
  processedKey?: string; // 압축본 R2 경로
  processedSize?: number; // 압축 후 파일 크기
  duration?: number; // 비디오 길이 (초)
  resolution?: number; // 해상도 (720 등)
  error?: string;
  processingTime: number; // 처리 시간 (ms)
}

/**
 * Queue 이름 상수
 */
export const VIDEO_PROCESSING_QUEUE = "video-processing";

/**
 * Redis 연결 옵션
 * 환경변수에서 읽어오며, 분산 배포를 위해 공유 Redis 사용
 */
export const getRedisConnection = (): Redis => {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

  return new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
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
      type: "exponential",
      delay: 5000, // 첫 재시도: 5초, 두 번째: 10초, 세 번째: 20초
    },
    removeOnComplete: {
      age: 86400, // 24시간 후 완료된 Job 자동 삭제
      count: 500, // 최대 500개까지 보관
    },
    removeOnFail: {
      age: 604800, // 7일 후 실패한 Job 자동 삭제
      count: 1000, // 최대 1000개까지 보관 (디버깅용)
    },
  },
};

/**
 * Video Processing Queue 인스턴스 생성
 *
 * 사용 예시:
 * ```typescript
 * // Job 추가
 * await videoProcessingQueue.add('compress-video', jobData);
 *
 * // Job 상태 조회
 * const job = await videoProcessingQueue.getJob(jobId);
 * const state = await job.getState();
 * ```
 */
export const videoProcessingQueue = new Queue<VideoProcessingJobData>(
  VIDEO_PROCESSING_QUEUE,
  queueOptions,
);

/**
 * Queue 정리 및 종료
 * 애플리케이션 종료 시 호출
 */
export const closeVideoQueue = async () => {
  await videoProcessingQueue.close();
};
