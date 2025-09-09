/**
 * Image Upload Utilities
 * 이미지 업로드 관련 유틸리티 함수
 */

import { IMAGE_UPLOAD_CONFIG, ERROR_MESSAGES } from '../constants/editor.constants';

/**
 * 파일 유효성 검사
 */
export const validateFile = (file: File): { valid: boolean; error?: string } => {
  // 파일 형식 검사
  if (!IMAGE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(file.type as any)) {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!IMAGE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.includes(extension as any)) {
      return { 
        valid: false, 
        error: ERROR_MESSAGES.INVALID_FILE_TYPE(file.name) 
      };
    }
  }

  // 파일 크기 검사
  if (file.size > IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: ERROR_MESSAGES.FILE_TOO_LARGE(file.name, IMAGE_UPLOAD_CONFIG.MAX_FILE_SIZE) 
    };
  }

  return { valid: true };
};

/**
 * 총 파일 크기 검사
 */
export const checkFileSizeQuota = (
  files: File[], 
  currentTotalSize: number
): { valid: boolean; error?: string } => {
  const newFilesSize = files.reduce((acc, file) => acc + file.size, 0);
  const totalSize = currentTotalSize + newFilesSize;

  if (totalSize > IMAGE_UPLOAD_CONFIG.MAX_TOTAL_SIZE) {
    return { 
      valid: false, 
      error: ERROR_MESSAGES.QUOTA_EXCEEDED(totalSize, IMAGE_UPLOAD_CONFIG.MAX_TOTAL_SIZE) 
    };
  }

  return { valid: true };
};

/**
 * 이미지 업로드 요청
 */
export const uploadImage = async (file: File): Promise<{ url: string; id: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
  const response = await fetch(`${apiUrl}${IMAGE_UPLOAD_CONFIG.API_ENDPOINT}`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(ERROR_MESSAGES.UPLOAD_FAILED);
  }

  const data = await response.json();
  return {
    url: data.url,
    id: data.id || generateImageId(),
  };
};

/**
 * 이미지 ID 생성
 */
export const generateImageId = (): string => {
  return `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * 이미지를 Base64로 변환
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 이미지 미리보기 URL 생성
 */
export const createPreviewUrl = (file: File): string => {
  return URL.createObjectURL(file);
};

/**
 * 미리보기 URL 해제
 */
export const revokePreviewUrl = (url: string): void => {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};