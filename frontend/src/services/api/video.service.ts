/**
 * 비디오 업로드 관련 API 서비스
 * R2 Presigned URL 생성, 업로드 완료 알림, 처리 상태 조회
 */

import {
  CreateVideoUploadUrlRequest,
  CreateVideoUploadUrlResponse,
  VideoUploadCompleteRequest,
  VideoUploadCompleteResponse,
  VideoStatusResponse,
} from '@/types/video';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 비디오 업로드용 Presigned URL 생성
 * R2에 직접 업로드할 수 있는 URL을 반환
 */
export async function createVideoUploadUrl(
  request: CreateVideoUploadUrlRequest,
): Promise<CreateVideoUploadUrlResponse> {
  const response = await fetch(`${API_URL}/files/video/upload-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '비디오 업로드 URL 생성에 실패했습니다.');
  }

  return response.json();
}

/**
 * R2에 비디오 파일 직접 업로드
 * Presigned URL을 사용하여 R2에 직접 업로드
 * @param uploadUrl - Presigned URL
 * @param file - 업로드할 비디오 파일
 * @param onProgress - 진행률 콜백 (0-100)
 */
export async function uploadVideoToR2(
  uploadUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // 진행률 이벤트
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      }
    });

    // 완료 이벤트
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`업로드 실패: ${xhr.status} ${xhr.statusText}`));
      }
    });

    // 에러 이벤트
    xhr.addEventListener('error', () => {
      reject(new Error('네트워크 오류로 업로드에 실패했습니다.'));
    });

    // 취소 이벤트
    xhr.addEventListener('abort', () => {
      reject(new Error('업로드가 취소되었습니다.'));
    });

    // 업로드 시작
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/**
 * 비디오 업로드 완료 알림
 * 업로드 완료 후 서버에 알려 BullMQ 처리 Job 생성
 */
export async function notifyVideoUploadComplete(
  request: VideoUploadCompleteRequest,
): Promise<VideoUploadCompleteResponse> {
  const response = await fetch(`${API_URL}/files/video/upload-complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '업로드 완료 알림에 실패했습니다.');
  }

  return response.json();
}

/**
 * 비디오 처리 상태 조회
 * 폴링을 통해 처리 완료 여부 확인
 */
export async function getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
  const response = await fetch(`${API_URL}/files/video/${videoId}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '비디오 상태 조회에 실패했습니다.');
  }

  return response.json();
}

/**
 * 비디오 처리 완료까지 폴링
 * @param videoId - 비디오 ID
 * @param options - 폴링 옵션
 * @returns 최종 비디오 상태
 */
export async function waitForVideoProcessing(
  videoId: string,
  options: {
    pollInterval?: number;
    maxAttempts?: number;
    onProgress?: (status: VideoStatusResponse) => void;
  } = {},
): Promise<VideoStatusResponse> {
  const { pollInterval = 3000, maxAttempts = 200, onProgress } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getVideoStatus(videoId);

    // 진행 상태 콜백
    if (onProgress) {
      onProgress(status);
    }

    // 처리 완료 또는 실패
    if (status.status === 'ready' || status.status === 'failed') {
      return status;
    }

    // 다음 폴링까지 대기
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error('비디오 처리 시간이 초과되었습니다.');
}
