/**
 * 스마트 이미지 변환 유틸리티
 * WebP 변환 규칙과 이미지 최적화 로직
 */

import * as path from 'path';

/**
 * 이미지 변환 설정
 */
export interface ImageConversionConfig {
  minSizeForConversion: number;  // WebP 변환 최소 크기 (bytes)
  maxWidth: number;               // 최대 너비 (pixels)
  maxHeight: number;              // 최대 높이 (pixels)
  webpQuality: number;            // WebP 품질 (0-100)
  preserveOriginalFormat: string[]; // 원본 포맷 유지할 확장자
}

/**
 * 기본 변환 설정
 */
export const DEFAULT_CONVERSION_CONFIG: ImageConversionConfig = {
  minSizeForConversion: 100 * 1024,  // 100KB 이상만 변환
  maxWidth: 2400,                     // 최대 2400px 너비
  maxHeight: 2400,                    // 최대 2400px 높이
  webpQuality: 90,                    // 90% 품질
  preserveOriginalFormat: ['.png', '.svg', '.ico', '.gif'], // 보존할 포맷
};

/**
 * 이미지 컨텍스트별 변환 규칙
 */
export const CONTEXT_CONVERSION_RULES = {
  // 포스트 이미지: 대부분 WebP로 변환
  post: {
    minSizeForConversion: 50 * 1024,   // 50KB 이상 변환
    webpQuality: 85,                    // 85% 품질
    preserveOriginalFormat: ['.svg', '.gif'], // SVG, GIF만 유지
  },
  
  // 프로필 이미지: 항상 WebP로 변환
  profile: {
    minSizeForConversion: 0,           // 모든 크기 변환
    webpQuality: 90,                   // 90% 품질
    maxWidth: 800,                      // 최대 800px
    maxHeight: 800,                     // 최대 800px
    preserveOriginalFormat: [],         // 모두 변환
  },
  
  // 블로그 브랜딩 (로고, 파비콘 등): PNG 유지
  blog: {
    minSizeForConversion: 200 * 1024,  // 200KB 이상만 변환
    webpQuality: 95,                   // 95% 고품질
    preserveOriginalFormat: ['.png', '.svg', '.ico'], // 로고류 포맷 유지
  },
  
  // 시스템 자산: 원본 유지
  system: {
    minSizeForConversion: 500 * 1024,  // 500KB 이상만 변환
    webpQuality: 95,                   // 95% 고품질
    preserveOriginalFormat: ['.png', '.svg', '.ico', '.gif', '.jpg'], // 대부분 유지
  },
};

/**
 * 이미지 타입 분류
 */
export enum ImageType {
  PHOTO = 'photo',        // 사진 (JPEG 계열)
  GRAPHIC = 'graphic',    // 그래픽/로고 (PNG 계열)
  ICON = 'icon',          // 아이콘 (작은 PNG/SVG)
  VECTOR = 'vector',      // 벡터 (SVG)
  ANIMATED = 'animated',  // 애니메이션 (GIF/APNG)
}

/**
 * 파일이 이미지인지 확인
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * WebP 변환이 필요한지 판단
 */
export function shouldConvertToWebP(
  fileName: string,
  fileSize: number,
  mimeType: string,
  context: 'post' | 'profile' | 'blog' | 'system' = 'post'
): boolean {
  // SVG는 절대 변환하지 않음 (벡터 형식)
  if (mimeType === 'image/svg+xml') {
    return false;
  }
  
  // 이미 WebP인 경우 변환하지 않음
  if (mimeType === 'image/webp') {
    return false;
  }
  
  // 컨텍스트별 규칙 적용
  const rules = CONTEXT_CONVERSION_RULES[context];
  const extension = path.extname(fileName).toLowerCase();
  
  // 보존할 포맷인지 확인
  if (rules.preserveOriginalFormat.includes(extension)) {
    return false;
  }
  
  // 최소 크기 체크
  if (fileSize < rules.minSizeForConversion) {
    return false;
  }
  
  // 나머지는 변환
  return true;
}

/**
 * 이미지 타입 감지
 */
export function detectImageType(fileName: string, mimeType: string, fileSize: number): ImageType {
  const extension = path.extname(fileName).toLowerCase();
  
  // 벡터 이미지
  if (mimeType === 'image/svg+xml' || extension === '.svg') {
    return ImageType.VECTOR;
  }
  
  // 애니메이션
  if (mimeType === 'image/gif' || extension === '.gif') {
    return ImageType.ANIMATED;
  }
  
  // 아이콘 (작은 PNG)
  if ((extension === '.png' || extension === '.ico') && fileSize < 50 * 1024) {
    return ImageType.ICON;
  }
  
  // 그래픽/로고 (PNG)
  if (extension === '.png') {
    return ImageType.GRAPHIC;
  }
  
  // 사진 (JPEG 등)
  return ImageType.PHOTO;
}

/**
 * 썸네일 사이즈 정의
 */
export const THUMBNAIL_SIZES = {
  tiny: { width: 150, height: 150, suffix: 'tiny' },     // 작은 썸네일
  small: { width: 400, height: 400, suffix: 'small' },   // 모바일용
  medium: { width: 800, height: 800, suffix: 'medium' }, // 태블릿용
  large: { width: 1600, height: 1600, suffix: 'large' }, // 데스크톱용
};

/**
 * 컨텍스트별 필요한 썸네일 사이즈
 */
export function getRequiredThumbnailSizes(context: string): typeof THUMBNAIL_SIZES[keyof typeof THUMBNAIL_SIZES][] {
  switch (context) {
    case 'profile':
      return [THUMBNAIL_SIZES.tiny, THUMBNAIL_SIZES.small, THUMBNAIL_SIZES.medium];
    case 'post':
      return [THUMBNAIL_SIZES.small, THUMBNAIL_SIZES.medium, THUMBNAIL_SIZES.large];
    case 'blog':
      return [THUMBNAIL_SIZES.tiny, THUMBNAIL_SIZES.small];
    default:
      return [THUMBNAIL_SIZES.small, THUMBNAIL_SIZES.medium];
  }
}

/**
 * 이미지 최적화 설정 생성
 */
export function getOptimizationConfig(
  imageType: ImageType,
  context: string
): { quality: number; format: string; shouldResize: boolean } {
  const baseConfig = CONTEXT_CONVERSION_RULES[context] || DEFAULT_CONVERSION_CONFIG;
  
  switch (imageType) {
    case ImageType.PHOTO:
      return {
        quality: baseConfig.webpQuality,
        format: 'webp',
        shouldResize: true,
      };
      
    case ImageType.GRAPHIC:
      // 그래픽/로고는 약간 높은 품질
      return {
        quality: Math.min(baseConfig.webpQuality + 5, 95),
        format: 'webp',
        shouldResize: true,
      };
      
    case ImageType.ICON:
      // 아이콘은 원본 유지
      return {
        quality: 100,
        format: 'png',
        shouldResize: false,
      };
      
    case ImageType.VECTOR:
      // SVG는 변환하지 않음
      return {
        quality: 100,
        format: 'svg',
        shouldResize: false,
      };
      
    case ImageType.ANIMATED:
      // GIF는 원본 유지 (WebP 애니메이션 지원 검토 필요)
      return {
        quality: 100,
        format: 'gif',
        shouldResize: false,
      };
      
    default:
      return {
        quality: baseConfig.webpQuality,
        format: 'webp',
        shouldResize: true,
      };
  }
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 이미지 변환 로그 메시지 생성
 */
export function getConversionLogMessage(
  fileName: string,
  originalSize: number,
  convertedSize: number,
  originalFormat: string,
  targetFormat: string
): string {
  const savedBytes = originalSize - convertedSize;
  const savedPercentage = ((savedBytes / originalSize) * 100).toFixed(1);
  
  return `Image conversion: ${fileName} | ${originalFormat} → ${targetFormat} | ` +
         `${formatFileSize(originalSize)} → ${formatFileSize(convertedSize)} ` +
         `(saved ${formatFileSize(savedBytes)}, ${savedPercentage}%)`;
}