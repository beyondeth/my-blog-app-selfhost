/**
 * 이미지 URL 처리 유틸리티
 * TanStack Query를 사용한 효율적인 이미지 로딩 및 상태 관리
 */

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';

// 환경변수에서 설정값 가져오기
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const USE_UUID_FILENAMES = process.env.NEXT_PUBLIC_USE_UUID_FILENAMES === 'true';
// 디버그 로그 비활성화 (필요 시 true로 변경)
const DEBUG_MODE = false;


/**
 * S3 키에서 프록시 URL 생성 (UUID 기반)
 */
export function getProxyImageUrl(s3Key: string): string {
  if (!s3Key) {
    if (DEBUG_MODE) console.warn('[imageUtils] Empty S3 key provided');
    return '';
  }

  // 이미 완전한 프록시 URL인 경우 그대로 반환
  if (s3Key.startsWith('http') && s3Key.includes('/api/v1/files/proxy/')) {
    if (DEBUG_MODE) console.log('[imageUtils] Already complete proxy URL:', s3Key);
    return s3Key;
  }

  // 상대 경로 프록시 URL인 경우 절대 URL로 변환
  if (s3Key.includes('/api/v1/files/proxy/')) {
    const absoluteUrl = `${BACKEND_URL}${s3Key.startsWith('/') ? s3Key : '/' + s3Key}`;
    if (DEBUG_MODE) console.log('[imageUtils] Converting relative to absolute proxy URL:', s3Key, '->', absoluteUrl);
    return absoluteUrl;
  }

  // S3 키에서 'uploads/' 처리
  let cleanKey = s3Key;
  
  // S3 직접 URL인 경우 키 추출
  if (s3Key.includes('.s3.') && s3Key.includes('amazonaws.com')) {
    const match = s3Key.match(/amazonaws\.com\/(.+?)(\?|$)/);
    if (match) {
      cleanKey = match[1];
    }
  }
  
  // uploads/ 접두사가 없으면 추가
  if (!cleanKey.startsWith('uploads/') && !cleanKey.startsWith('v2/')) {
    cleanKey = `uploads/${cleanKey}`;
  }
  
  // API_URL 사용 - /api/v1 이미 포함되어 있음
  const proxyUrl = `${API_URL}/files/proxy/${cleanKey}`;
  
  if (DEBUG_MODE) {
    console.log('[imageUtils] Generated proxy URL:', {
      input: s3Key,
      cleanKey,
      output: proxyUrl
    });
  }

  return proxyUrl;
}

/**
 * 다양한 이미지 URL 형식을 정규화된 프록시 URL로 변환
 */
export function normalizeImageUrl(url: string): string {
  if (!url) {
    if (DEBUG_MODE) console.warn('[normalizeImageUrl] Empty URL provided');
    return '';
  }

  try {
    // 디버깅을 위한 입력 로그
    if (DEBUG_MODE) console.log('[normalizeImageUrl] Input:', url);

    // CDN URL은 그대로 사용 (프록시 불필요)
    if (url.includes('cdn.codebase.blog')) {
      if (DEBUG_MODE) console.log('[normalizeImageUrl] CDN URL, using directly');
      return url;
    }

    // YouTube 썸네일 URL은 직접 사용 (프록시 불필요)
    if (url.includes('img.youtube.com') || url.includes('ytimg.com')) {
      if (DEBUG_MODE) console.log('[normalizeImageUrl] YouTube URL, using directly');
      return url;
    }

    // 캐릭터 이미지 경로는 Next.js public 폴더에서 직접 제공 (프록시 불필요)
    // /public/character/*.jpeg 파일들을 정적 파일로 직접 사용
    if (url.startsWith('/character/')) {
      if (DEBUG_MODE) console.log('[normalizeImageUrl] Character image, using directly from public folder');
      return url;
    }

    // Oracle OCI Object Storage presigned URL 처리
    if (url.includes('oraclecloud.com')) {
      // OCI presigned URL에서 S3 키 추출
      // 형식: https://{namespace}.compat.objectstorage.{region}.oraclecloud.com/{bucket}/{key}?...
      const match = url.match(/oraclecloud\.com\/[^\/]+\/(.+?)(\?|$)/);
      if (match && match[1]) {
        const s3Key = match[1];
        const proxyUrl = getProxyImageUrl(s3Key);
        if (DEBUG_MODE) console.log('[normalizeImageUrl] OCI URL → Proxy:', { input: url, key: s3Key, output: proxyUrl });
        return proxyUrl;
      }
    }

    // 외부 HTTPS URL은 그대로 사용
    if (url.startsWith('https://') && !url.includes('amazonaws.com') && !url.includes('oraclecloud.com') && !url.includes('/api/v1/files/')) {
      if (DEBUG_MODE) console.log('[normalizeImageUrl] External HTTPS URL, using directly');
      return url;
    }

    // /api/v1/files/{uuid}/download 형식인 경우 그대로 사용
    if (url.includes('/api/v1/files/') && url.includes('/download')) {
      // 이미 절대 URL인 경우
      if (url.startsWith('http')) {
        if (DEBUG_MODE) console.log('[normalizeImageUrl] Download URL (absolute), using directly');
        return url;
      }
      // 상대 경로인 경우 절대 경로로 변환
      const absoluteUrl = `${BACKEND_URL}${url.startsWith('/') ? url : '/' + url}`;
      if (DEBUG_MODE) console.log('[normalizeImageUrl] Download URL (relative):', absoluteUrl);
      return absoluteUrl;
    }

    // 이미 완전한 프록시 URL인 경우
    if (url.includes('/api/v1/files/proxy/')) {
      // 이미 정확한 형식이면 그대로 반환
      if (url.startsWith('http')) {
        if (DEBUG_MODE) console.log('[normalizeImageUrl] Proxy URL (absolute), using directly');
        return url;
      }
      // 상대 경로인 경우 절대 경로로 변환
      const absoluteUrl = `${API_URL.replace('/api/v1', '')}${url}`;
      if (DEBUG_MODE) console.log('[normalizeImageUrl] Proxy URL (relative):', absoluteUrl);
      return absoluteUrl;
    }

    // S3 직접 URL인 경우
    if (url.includes('.s3.') && url.includes('amazonaws.com')) {
      // 서명된 URL (쿼리 파라미터가 있는 경우)은 그대로 사용
      if (url.includes('X-Amz-Signature') || url.includes('?')) {
        if (DEBUG_MODE) console.log('[normalizeImageUrl] Signed S3 URL, using directly');
        return url;
      }
      // 서명이 없는 경우만 프록시 사용
      const proxyUrl = getProxyImageUrl(url);
      if (DEBUG_MODE) console.log('[normalizeImageUrl] S3 URL → Proxy:', proxyUrl);
      return proxyUrl;
    }

    // 이미 S3 키인 경우 (uploads/로 시작)
    if (url.startsWith('uploads/') || url.startsWith('v2/')) {
      const proxyUrl = getProxyImageUrl(url);
      if (DEBUG_MODE) console.log('[normalizeImageUrl] S3 key → Proxy:', proxyUrl);
      return proxyUrl;
    }

    // Bare 파일명 감지 (경로 구분자가 없고 확장자만 있는 경우)
    // 예: "freepik__my-blog-svg-__77128.png"
    const isBareFilename = !url.includes('/') &&
                          !url.startsWith('http') &&
                          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);

    if (isBareFilename) {
      console.warn('[normalizeImageUrl] Bare filename detected:', url);
      // Bare 파일명을 uploads/ 경로로 변환하여 프록시 URL 생성
      const proxyUrl = getProxyImageUrl(url);
      console.log('[normalizeImageUrl] Bare filename → Proxy:', proxyUrl);
      return proxyUrl;
    }

    // 기타 경우 프록시 URL로 변환 시도
    const proxyUrl = getProxyImageUrl(url);
    if (DEBUG_MODE) console.log('[normalizeImageUrl] Default → Proxy:', proxyUrl);
    return proxyUrl;

  } catch (error) {
    console.error('[imageUtils] Error normalizing URL:', url, error);
    return url;
  }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 이미지 MIME 타입 검증
 */
export function isImageMimeType(mimeType: string): boolean {
  const supportedTypes = (process.env.NEXT_PUBLIC_SUPPORTED_IMAGE_TYPES || 
    'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/svg+xml').split(',');
  
  return supportedTypes.includes(mimeType.toLowerCase());
}

/**
 * 파일 크기 검증
 */
export function validateFileSize(size: number): boolean {
  const maxSize = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760');
  return size <= maxSize;
}

/**
 * 이미지 파일 검증 (크기 + MIME 타입)
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  const maxSize = 10 * 1024 * 1024; // 10MB
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (file.size > maxSize) {
    return { valid: false, error: '파일 크기가 10MB를 초과합니다.' };
  }
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: '지원되지 않는 파일 형식입니다.' };
  }
  return { valid: true };
}

/**
 * UUID 파일명 생성 (클라이언트용)
 */
export function generateClientUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 이미지 최적화 설정 가져오기
 */
export function getImageOptimizationSettings() {
  return {
    quality: parseInt(process.env.NEXT_PUBLIC_IMAGE_QUALITY || '80'),
    maxWidth: parseInt(process.env.NEXT_PUBLIC_MAX_IMAGE_WIDTH || '2048'),
    maxHeight: parseInt(process.env.NEXT_PUBLIC_MAX_IMAGE_HEIGHT || '2048'),
  };
}

/**
 * 이미지 리사이징 (Canvas 사용)
 */
export function resizeImage(
  file: File,
  maxWidth: number = 2048,
  maxHeight: number = 2048,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // 원본 크기
      let { width, height } = img;

      // 비율 유지하면서 크기 조정
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      // 캔버스 크기 설정
      canvas.width = width;
      canvas.height = height;

      // 이미지 그리기
      ctx?.drawImage(img, 0, 0, width, height);

      // Blob으로 변환
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        file.type,
        quality
      );
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = URL.createObjectURL(file);
  });
}

/**
 * 이미지 미리보기 URL 생성
 */
export function createImagePreview(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * 이미지 미리보기 URL 해제
 */
export function revokeImagePreview(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * 디버그 로그 출력
 */
export function debugLog(message: string, data?: any): void {
  if (process.env.NODE_ENV === 'development') {
    if (data) {
      console.log(`[DEBUG] ${message}`, data);
    } else {
      console.log(`[DEBUG] ${message}`);
    }
  }
}

/**
 * 이미지 로딩 상태를 관리하는 React Query 훅
 */
export function useImageQuery(imageUrl: string | null | undefined) {
  return useQuery({
    queryKey: ['image', imageUrl],
    queryFn: async () => {
      if (!imageUrl) throw new Error('No image URL provided');
      
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to load image: ${response.status}`);
      }
      
      return imageUrl;
    },
    enabled: !!imageUrl,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분 (TanStack Query v5에서 cacheTime -> gcTime)
    retry: 2,
  });
}

/**
 * 이미지 로더 훅 (로딩 상태 포함)
 * Context7 모범 사례: 클린업과 메모이제이션 적용
 */
export function useImageLoader(imageUrl: string | null | undefined) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  
  React.useEffect(() => {
    if (!imageUrl) {
      setLoadedUrl(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false; // 클린업 플래그

    const loadImage = async () => {
      if (cancelled) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const img = new Image();
        
        img.onload = () => {
          if (!cancelled) {
            setLoadedUrl(imageUrl);
            setIsLoading(false);
    }
        };
        
        img.onerror = (e) => {
          if (!cancelled) {
            console.error('[useImageLoader] Failed to load image:', imageUrl, e);
            setError('Failed to load image');
            setIsLoading(false);
          }
        };
        
        img.src = imageUrl;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    };

    loadImage();

    // 클린업 함수
    return () => {
      cancelled = true;
    };
  }, [imageUrl]); // loadImage 함수를 의존성에서 제거

  return { isLoading, error, loadedUrl };
}

/**
 * 이미지 컴포넌트에서 사용할 props 생성
 */
export function createImageProps(imageUrl: string | null | undefined) {
  const normalizedUrl = imageUrl ? normalizeImageUrl(imageUrl) : '';
  
  return {
    src: normalizedUrl,
    onError: (e: React.SyntheticEvent<HTMLImageElement>) => {
      const target = e.target as HTMLImageElement;
      console.error('[imageUtils] Image load failed:', target.src);
      
      // 원본 URL로 재시도
      if (imageUrl && target.src !== imageUrl) {
        target.src = imageUrl;
      }
    },
    loading: 'lazy' as const,
  };
}

/**
 * 이미지 URL에서 파일 확장자 추출
 */
export function getImageExtension(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split('.').pop()?.toLowerCase();
    return extension || '';
  } catch {
    // URL이 아닌 경우 직접 확장자 추출
    const extension = url.split('.').pop()?.toLowerCase();
    return extension || '';
  }
}

/**
 * 이미지 URL이 유효한지 확인
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  
  try {
    new URL(url);
    return true;
  } catch {
    // 상대 경로나 S3 키인 경우도 유효할 수 있음
    return url.includes('/') || url.includes('.');
  }
}

/**
 * HTML 태그를 제거하고 순수 텍스트만 반환
 */
export function stripHtmlTags(html: string): string {
  if (!html) return '';
  
  // HTML 태그 제거
  const withoutTags = html.replace(/<[^>]*>/g, '');
  
  // HTML 엔티티 디코딩
  const withoutEntities = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // 연속된 공백을 하나로 변환하고 앞뒤 공백 제거
  return withoutEntities.replace(/\s+/g, ' ').trim();
}

/**
 * 이미지를 WebP 형식으로 변환
 */
export async function convertImageToWebP(file: File): Promise<File> {
  const imageCompression = (await import('browser-image-compression')).default;
  const options = {
    fileType: 'image/webp',
    useWebWorker: true,
    maxSizeMB: 5,
    maxWidthOrHeight: 3840,
  };
  const webpFile = await imageCompression(file, options);
  return new File([webpFile], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' });
} 