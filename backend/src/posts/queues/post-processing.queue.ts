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

/**
 * Job 데이터 타입 정의
 *
 * 주요 Job 타입:
 * - process-post: 포스트 발행 처리 (userId, blogId, title, content 필수)
 * - cleanup-deleted-post: 삭제된 포스트 정리 (postId, blogId, content 필수)
 */
export interface PostProcessingJobData {
  postId: string; // 처리할 포스트 ID
  userId?: string; // 작성자 ID (권한 확인용, cleanup에서는 불필요)
  blogId: string; // 블로그 ID
  title?: string; // 제목 (cleanup에서는 불필요)
  content?: string; // 원본 Markdown 컨텐츠 또는 HTML (cleanup에서는 HTML)
  tags?: string[]; // 태그 목록
  category?: string; // 카테고리
}

/**
 * Job 처리 결과 타입
 */
export interface PostProcessingResult {
  success: boolean;
  postId: string;
  status: "published" | "failed";
  error?: string;
  processingTime: number; // 처리 시간 (ms)
}

/**
 * Queue 이름 상수
 */
export const POST_PROCESSING_QUEUE = "post-processing";
