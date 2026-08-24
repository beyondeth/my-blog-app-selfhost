/**
 * 이미지 URL 처리 유틸리티
 * TanStack Query를 사용한 효율적인 이미지 로딩 및 상태 관리
 */

import React, { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

// 환경변수에서 설정값 가져오기
const CDN_BASE_URL = (process.env.NEXT_PUBLIC_CDN_BASE_URL || '').replace(/\/$/, '');
const STORAGE_PUBLIC_URL = (process.env.NEXT_PUBLIC_STORAGE_PUBLIC_URL || '').replace(/\/$/, '');
const USE_UUID_FILENAMES = process.env.NEXT_PUBLIC_USE_UUID_FILENAMES === 'true';
// 디버그 로그 비활성화 (필요 시 true로 변경)
const DEBUG_MODE = false;

const FILE_API_PATH_PREFIX = '/api/v1/files/';
const FILE_PROXY_PATH_PREFIX = `${FILE_API_PATH_PREFIX}proxy/`;

/**
 * 백엔드 파일 URL을 프론트엔드의 same-origin API 경로로 변환합니다.
 *
 * self-host 환경에서는 백엔드가 localhost:13000으로 노출되지만 브라우저는
 * 프론트엔드(13001)를 통해 접근하는 편이 안전하고 Next Image 설정에도
 * 외부 호스트를 추가할 필요가 없습니다.
 */
function toSameOriginFilePath(url: string): string | null {
  let pathname: string;
  let suffix = '';

  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      pathname = parsed.pathname;
      suffix = `${parsed.search}${parsed.hash}`;
    } else if (url.startsWith('/')) {
      const parsed = new URL(url, 'http://localhost');
      pathname = parsed.pathname;
      suffix = `${parsed.search}${parsed.hash}`;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  if (!pathname.startsWith(FILE_API_PATH_PREFIX)) {
    return null;
  }

  // 정적 캐릭터 이미지는 Object Storage 파일이 아니므로 프록시 경로를
  // 만들지 않고 프론트엔드 public 폴더에서 직접 제공합니다.
  if (pathname.startsWith(`${FILE_PROXY_PATH_PREFIX}character/`)) {
    return `/character/${pathname.slice(`${FILE_PROXY_PATH_PREFIX}character/`.length)}${suffix}`;
  }

  return `${pathname}${suffix}`;
}

/**
 * 설정된 public storage URL에서 uploads/v2 객체 키를 추출합니다.
 * MinIO의 path-style URL(예: /blog/uploads/...)과 외부 S3 호환 URL을
 * 모두 처리해 오래된 직접 저장소 URL도 백엔드 프록시로 통일합니다.
 */
function extractConfiguredStorageKey(url: string): string | null {
  if (!STORAGE_PUBLIC_URL) {
    return null;
  }

  try {
    const configured = new URL(STORAGE_PUBLIC_URL);
    const parsed = new URL(url);
    if (configured.origin !== parsed.origin) {
      return null;
    }

    const path = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    const keyStart = ['uploads/', 'v2/']
      .map((prefix) => path.indexOf(prefix))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0];

    return keyStart === undefined ? null : path.slice(keyStart);
  } catch {
    return null;
  }
}


/**
 * S3 키에서 프록시 URL 생성 (UUID 기반)
 */
export function getProxyImageUrl(s3Key: string): string {
  if (!s3Key) {
    if (DEBUG_MODE) console.warn('[imageUtils] Empty S3 key provided');
    return '';
  }

  // 이미 완전한 파일 URL인 경우 same-origin 경로로 통일
  if (s3Key.startsWith('http') && s3Key.includes('/api/v1/files/proxy/')) {
    const sameOriginPath = toSameOriginFilePath(s3Key);
    if (DEBUG_MODE) console.log('[imageUtils] Already complete proxy URL:', s3Key);
    return sameOriginPath || s3Key;
  }

  // 상대 경로 파일 URL은 그대로 사용
  if (s3Key.includes('/api/v1/files/proxy/')) {
    const relativePath = s3Key.slice(s3Key.indexOf('/api/v1/files/proxy/'));
    const sameOriginPath = toSameOriginFilePath(relativePath);
    if (DEBUG_MODE) console.log('[imageUtils] Keeping relative proxy URL:', relativePath);
    return sameOriginPath || relativePath;
  }

  const configuredStorageKey = extractConfiguredStorageKey(s3Key);

  // S3 키에서 'uploads/' 처리
  let cleanKey = configuredStorageKey || s3Key;
  
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
  
  // same-origin API rewrite를 통해 백엔드 프록시로 연결
  const proxyUrl = `${FILE_PROXY_PATH_PREFIX}${encodeURI(cleanKey)}`;
  
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

  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  // 백엔드 파일 URL은 저장소 호스트 대신 프론트엔드 same-origin 경로를 사용
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const sameOriginPath = toSameOriginFilePath(url);
    if (sameOriginPath) {
      return sameOriginPath;
    }

    // 공개 CDN과 storage public URL이 같은 운영 구성에서는 CDN URL을
    // 저장소 원본으로 오인해 API 프록시로 되돌리지 않는다.
    if (CDN_BASE_URL && (url === CDN_BASE_URL || url.startsWith(`${CDN_BASE_URL}/`))) {
      return url;
    }

    const configuredStorageKey = extractConfiguredStorageKey(url);
    if (configuredStorageKey) {
      return getProxyImageUrl(configuredStorageKey);
    }

    // 일반 외부 이미지는 원본 URL을 유지
    if (DEBUG_MODE) console.log('[normalizeImageUrl] Absolute URL detected, returning directly:', url);
    return url;
  }

  try {
    // 디버깅을 위한 입력 로그
    if (DEBUG_MODE) console.log('[normalizeImageUrl] Input:', url);

    // Configured CDN URL은 그대로 사용 (프록시 불필요)
    if (CDN_BASE_URL && url.startsWith(CDN_BASE_URL)) {
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

    // Google Cloud Storage URL 처리 (Gemini 이미지 포함)
    // Gemini는 보통 임시 서명된 URL을 생성하므로 특별 처리 필요
    if (url.includes('storage.googleapis.com') || url.includes('gemini') && url.includes('googleapis.com')) {
      // Gemini 이미지는 프록시 사용 불가 (임시 토큰, 만료 시간 있음)
      // CDN에 이미 업로드된 버전이 있는지 확인하는 로직이 필요
      // 현재는 googleapis URL을 그대로 반환하되, Next.js Image 컴포넌트에서 unoptimized 사용 권장
      if (DEBUG_MODE) {
        console.log('[normalizeImageUrl] Google Storage/Gemini URL detected:', url);
        console.log('[normalizeImageUrl] Note: Gemini URLs require unoptimized Image component');
      }

      // 더 강력한 regex 패턴으로 다양한 googleapis URL 형식 지원
      // 1. https://storage.googleapis.com/{bucket}/{key}
      // 2. https://{bucket}.storage.googleapis.com/{key}
      // 3. https://storage.googleapis.com/gemini-generative-ai-dev-tools-prod/{uuid}
      const patterns = [
        /storage\.googleapis\.com\/([^\/]+)\/(.+?)(\?|$)/,  // 표준 형식
        /([^.]+)\.storage\.googleapis\.com\/(.+?)(\?|$)/,    // 버킷 서브도메인 형식
        /storage\.googleapis\.com\/gemini-[^\/]+\/(.+?)(\?|$)/  // Gemini 특수 형식
      ];

      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) {
          // Gemini URL의 경우 프록시 시도하지 않고 직접 사용
          // (백엔드에서 이미 다운로드하여 CDN에 저장하는 로직이 있음)
          if (url.includes('gemini')) {
            console.warn('[normalizeImageUrl] Gemini image detected. Use unoptimized prop in Next.js Image component:', url);
            return url;
          }
          // 일반 Google Storage URL은 프록시 시도
          const s3Key = match[match.length - 2];
          const proxyUrl = getProxyImageUrl(s3Key);
          if (DEBUG_MODE) console.log('[normalizeImageUrl] Google Storage URL → Proxy:', { input: url, key: s3Key, output: proxyUrl });
          return proxyUrl;
        }
      }

      // 패턴 매칭 실패 시에도 googleapis URL은 그대로 사용
      // (Next.js Image 컴포넌트에서 unoptimized 처리 필요)
      if (DEBUG_MODE) console.log('[normalizeImageUrl] Google Storage URL pattern not matched, using directly:', url);
      return url;
    }

    // 외부 HTTPS URL은 그대로 사용 (storage.googleapis.com는 위에서 처리했으므로 제외)
    if (url.startsWith('https://') && !url.includes('amazonaws.com') && !url.includes('oraclecloud.com') && !url.includes('storage.googleapis.com') && !url.includes('/api/v1/files/')) {
      if (DEBUG_MODE) console.log('[normalizeImageUrl] External HTTPS URL, using directly');
      return url;
    }

    // /api/v1/files/{uuid}/download 형식은 same-origin 경로로 사용
    if (url.includes('/api/v1/files/') && url.includes('/download')) {
      const sameOriginPath = toSameOriginFilePath(url);
      if (sameOriginPath) return sameOriginPath;
      return url.startsWith('/') ? url : `/${url}`;
    }

    // 이미 완전한 프록시 URL인 경우
    if (url.includes('/api/v1/files/proxy/')) {
      const sameOriginPath = toSameOriginFilePath(url);
      if (sameOriginPath) return sameOriginPath;
      return url.startsWith('/') ? url : `/${url}`;
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
      if (CDN_BASE_URL) {
        const cdnUrl = `${CDN_BASE_URL}/${url}`;
        if (DEBUG_MODE) console.log('[normalizeImageUrl] S3 key → CDN:', cdnUrl);
        return cdnUrl;
      }

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
 * 업로드된 이미지의 논리적 키(uploads/... 형태)를 추출
 * - CDN/프록시/상대경로 모두 동일한 키로 식별 가능
 */
export function extractImageKey(url: string): string | null {
  if (!url) return null;

  const extractFromPath = (path: string) => {
    const uploadsIndex = path.indexOf('uploads/');
    if (uploadsIndex !== -1) {
      return path.slice(uploadsIndex);
    }
    if (path.startsWith('v2/')) {
      return path;
    }
    const proxyIndex = path.indexOf('/api/v1/files/proxy/');
    if (proxyIndex !== -1) {
      return path.slice(proxyIndex + '/api/v1/files/proxy/'.length);
    }
    return null;
  };

  try {
    if (url.startsWith('uploads/') || url.startsWith('v2/')) {
      return url;
    }

    if (url.startsWith('/')) {
      return extractFromPath(url);
    }

    const parsed = new URL(url);
    const fromPath = extractFromPath(parsed.pathname);
    if (fromPath) {
      return fromPath;
    }
    const keyParam = parsed.searchParams.get('key');
    if (keyParam) {
      return keyParam.startsWith('uploads/') || keyParam.startsWith('v2/')
        ? keyParam
        : `uploads/${keyParam}`;
    }
  } catch {
    // URL 생성 실패 시 단순 패턴만 확인
    if (url.includes('uploads/')) {
      return url.slice(url.indexOf('uploads/'));
    }
  }

  return null;
}

/**
 * 게시글 이미지 목록을 썸네일 순서로 정렬하되, 같은 업로드 파일의 CDN URL을
 * 오래된 API 프록시 URL보다 우선합니다.
 */
export function getPreferredPostImageSources(
  images: Array<string | null | undefined> | null | undefined,
  thumbnail?: string | null,
): string[] {
  const normalizedImages = (Array.isArray(images) ? images : [])
    .map((url) => (typeof url === 'string' ? normalizeImageUrl(url) : ''))
    .filter((url): url is string => Boolean(url && url.trim()));
  const normalizedThumbnail = thumbnail ? normalizeImageUrl(thumbnail) : '';
  const prioritized = normalizedThumbnail
    ? [normalizedThumbnail, ...normalizedImages]
    : normalizedImages;
  const preferredByKey = new Map<string, string>();

  prioritized.forEach((url) => {
    const key = extractImageKey(url);
    if (!key) {
      return;
    }

    const existing = preferredByKey.get(key);
    const isProxyUrl = url.includes(FILE_PROXY_PATH_PREFIX);
    if (!existing || (existing.includes(FILE_PROXY_PATH_PREFIX) && !isProxyUrl)) {
      preferredByKey.set(key, url);
    }
  });

  const unique: string[] = [];
  const seen = new Set<string>();

  prioritized.forEach((url) => {
    const key = extractImageKey(url) ?? url;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    unique.push(preferredByKey.get(key) ?? url);
  });

  return unique;
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
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (file.size > maxSize) {
    return { valid: false, error: '파일 크기가 10MB를 초과합니다.' };
  }
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: '지원되지 않는 파일 형식입니다.' };
  }
  return { valid: true };
}

/**
 * 고유한 파일명 생성 (환경설정 기반)
 * - USE_UUID_FILENAMES가 true면 UUID 사용
 * - false면 원본 파일명 + 타임스탬프 사용
 */
export function generateUniqueFileName(originalName: string, mimeType?: string): string {
  const extension = mimeType ? getExtensionFromMimeType(mimeType) : getFileExtension(originalName);
  const baseName = originalName.replace(/\.[^/.]+$/, ''); // 확장자 제거

  if (USE_UUID_FILENAMES) {
    // UUID 기반 파일명
    const uuid = generateClientUuid();
    return extension ? `${uuid}.${extension}` : uuid;
  } else {
    // 타임스탬프 기반 파일명
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const sanitizedName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
    return `${sanitizedName}_${timestamp}_${randomSuffix}.${extension}`;
  }
}

/**
 * MIME 타입에서 확장자 추출
 */
function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: { [key: string]: string } = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  };
  return mimeToExt[mimeType.toLowerCase()] || 'bin';
}

/**
 * 파일명에서 확장자 추출
 */
function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}

/**
 * UUID 파일명 생성 (클라이언트용)
 * - crypto.randomUUID() 사용으로 보안 강화
 * - Math.random() 대신 예측 불가능한 UUID 생성
 */
export function generateClientUuid(): string {
  // 브라우저 환경에서 crypto.randomUUID() 사용 (Node.js 15.6+, 브라우저 지원)
  if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  // fallback: 기존 로직 (보안 등급은 낮지만 호환성 유지)
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
 * Gemini 생성 이미지 URL인지 확인
 * Gemini 이미지는 Next.js Image 최적화를 비활성화해야 함 (unoptimized prop 사용)
 */
export function isGeminiImageUrl(url: string): boolean {
  if (!url) return false;

  // Gemini가 생성하는 URL 패턴들
  return (
    // storage.googleapis.com/gemini-* 패턴
    (url.includes('storage.googleapis.com') && url.includes('gemini')) ||
    // gemini-*.googleapis.com 패턴
    (url.includes('gemini') && url.includes('googleapis.com')) ||
    // Google Cloud Storage 임시 서명된 URL (X-Goog-* 파라미터)
    (url.includes('storage.googleapis.com') &&
     (url.includes('X-Goog-Signature') || url.includes('X-Goog-Algorithm')))
  );
}

/**
 * 이미지 URL이 최적화 가능한지 확인
 * 알려진 도메인만 최적화하고, 나머지는 모두 unoptimized 처리
 */
export function shouldOptimizeImage(url: string): boolean {
  if (!url) return false;

  // Gemini 이미지는 최적화 불가
  if (isGeminiImageUrl(url)) return false;

  // 최적화 가능한 도메인 목록 (next.config.js remotePatterns에 등록된 도메인)
  let configuredCdnHost: string | null = null;
  if (CDN_BASE_URL) {
    try {
      configuredCdnHost = new URL(CDN_BASE_URL).hostname;
    } catch {
      configuredCdnHost = null;
    }
  }

  const optimizedDomains = [
    'lh3.googleusercontent.com',
    '/api/v1/files/proxy/',
    ...(configuredCdnHost ? [configuredCdnHost] : []),
  ];

  // 알려진 도메인인 경우만 최적화
  return optimizedDomains.some(domain => url.includes(domain));
}

/**
 * 이미지가 최적화되지 않아야 하는지 확인 (shouldOptimizeImage의 반대)
 * PostArticle 등에서 unoptimized prop 값으로 직접 사용
 */
export function shouldDisableOptimization(url: string): boolean {
  return !shouldOptimizeImage(url);
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
