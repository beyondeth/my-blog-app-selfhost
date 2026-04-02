/**
 * 마켓플레이스 파일 업로드 API 서비스
 * 격리(quarantine) 플로우: URL 발급 → S3 업로드 → 확인/검증
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export interface QuarantineUploadResponse {
  uploadUrl: string;
  quarantineId: string;
  quarantineKey: string;
}

export interface QuarantineConfirmResponse {
  status: string;
  quarantineKey: string;
}

/** 격리 업로드 presigned URL 발급 */
export async function requestQuarantineUpload(data: {
  originalName: string;
  mimeType: string;
  fileSize: number;
}): Promise<QuarantineUploadResponse> {
  const response = await fetch(`${API_URL}/marketplace/seller/upload/quarantine`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '업로드 URL 발급에 실패했습니다');
  }

  const result = await response.json();
  return result.data;
}

/**
 * S3 presigned URL로 파일 직접 업로드 (XMLHttpRequest for progress)
 * fetch()는 upload progress를 지원하지 않으므로 XHR 사용
 */
export function uploadToS3WithProgress(
  file: File,
  uploadUrl: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 업로드 실패 (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('네트워크 오류')));
    xhr.addEventListener('abort', () => reject(new Error('업로드 취소됨')));

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

/** 격리 업로드 완료 확인 (magic bytes 검증) */
export async function confirmQuarantineUpload(
  quarantineId: string,
): Promise<QuarantineConfirmResponse> {
  const response = await fetch(`${API_URL}/marketplace/seller/upload/confirm`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quarantineId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || '파일 검증에 실패했습니다');
  }

  const result = await response.json();
  return result.data;
}
