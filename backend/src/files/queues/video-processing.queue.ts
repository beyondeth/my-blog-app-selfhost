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
