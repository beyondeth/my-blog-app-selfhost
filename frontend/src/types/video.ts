/**
 * 비디오 업로드 관련 타입 정의
 */

// 비디오 상태
export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

// 비디오 업로드 단계
export type VideoUploadStage = 'idle' | 'uploading' | 'processing' | 'complete' | 'error';

// 비디오 업로드 상태
export interface VideoUploadState {
  stage: VideoUploadStage;
  uploadProgress: number;     // 업로드 진행률 (0-100)
  processingStatus: string;   // 서버 처리 상태 메시지
  error: string | null;
}

// 지원하는 비디오 MIME 타입
export type SupportedVideoMimeType =
  | 'video/mp4'
  | 'video/webm'
  | 'video/quicktime'
  | 'video/x-msvideo'
  | 'video/x-matroska'
  | 'video/mpeg'
  | 'video/3gpp'
  | 'video/x-ms-wmv'
  | 'video/ogg'
  | 'video/x-flv';

// Presigned URL 생성 요청
export interface CreateVideoUploadUrlRequest {
  fileName: string;
  mimeType: SupportedVideoMimeType;
  fileSize: number;
}

// Presigned URL 생성 응답
export interface CreateVideoUploadUrlResponse {
  uploadUrl: string;
  fileKey: string;
  videoId: string;
  expiresIn: number;
  success?: boolean;
  error?: string;
}

// 업로드 완료 요청
export interface VideoUploadCompleteRequest {
  fileKey: string;
  fileName: string;
  fileSize: number;
}

// 업로드 완료 응답
export interface VideoUploadCompleteResponse {
  success: boolean;
  videoId: string;
  status: 'processing';
  message: string;
  error?: string;
}

// 비디오 상태 조회 응답
export interface VideoStatusResponse {
  videoId: string;
  status: VideoStatus;
  url?: string;           // 재생 가능한 URL (ready 상태일 때만)
  duration?: number;      // 비디오 길이 (초)
  resolution?: number;    // 해상도 (720 등)
  sizeOriginal?: number;  // 원본 크기 (bytes)
  sizeProcessed?: number; // 압축 크기 (bytes)
  error?: string;         // 에러 메시지 (failed 상태일 때만)
  success?: boolean;
}

// 비디오 업로드 결과
export interface VideoUploadResult {
  success: boolean;
  videoId: string;
  status: VideoStatus;
  url?: string;
  error?: string;
}

// 비디오 설정
export interface VideoConfig {
  maxFileSize: number;        // 최대 파일 크기 (bytes)
  allowedMimeTypes: string[]; // 허용된 MIME 타입
  pollInterval: number;       // 상태 폴링 간격 (ms)
  maxPollAttempts: number;    // 최대 폴링 시도 횟수
}

// 기본 비디오 설정
export const DEFAULT_VIDEO_CONFIG: VideoConfig = {
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedMimeTypes: [
    'video/mp4',           // .mp4 - 가장 범용적
    'video/webm',          // .webm - 웹 최적화
    'video/quicktime',     // .mov - iPhone/Mac
    'video/x-msvideo',     // .avi - Windows 레거시
    'video/x-matroska',    // .mkv - 고품질 컨테이너
    'video/mpeg',          // .mpeg, .mpg - 레거시
    'video/3gpp',          // .3gp - 모바일
    'video/x-ms-wmv',      // .wmv - Windows Media
    'video/ogg',           // .ogv - 오픈소스
    'video/x-flv',         // .flv - Flash (레거시)
  ],
  pollInterval: 3000,  // 3초
  maxPollAttempts: 200, // 10분 (3초 * 200 = 600초)
};

// 비디오 MIME 타입 검증
export function isValidVideoMimeType(mimeType: string): mimeType is SupportedVideoMimeType {
  return DEFAULT_VIDEO_CONFIG.allowedMimeTypes.includes(mimeType);
}

// 파일 크기 검증
export function isValidVideoFileSize(fileSize: number): boolean {
  return fileSize > 0 && fileSize <= DEFAULT_VIDEO_CONFIG.maxFileSize;
}

// 파일 크기 포맷팅
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
