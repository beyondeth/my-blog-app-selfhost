/**
 * 클라이언트 사이드 이미지 변환 유틸리티
 * browser-image-compression을 사용한 스마트 WebP 변환
 */

import imageCompression from 'browser-image-compression';

/**
 * 이미지 변환 옵션
 */
export interface ImageConversionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  quality?: number;
  preserveOriginalFormat?: boolean;
}

/**
 * 컨텍스트별 변환 설정
 */
export const CONVERSION_PRESETS = {
  // 포스트 이미지: 적극적인 압축
  post: {
    maxSizeMB: 2,
    maxWidthOrHeight: 2400,
    quality: 0.85,
    fileType: 'image/webp',
  },
  
  // 프로필 이미지: 작은 크기, 높은 품질
  profile: {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 800,
    quality: 0.90,
    fileType: 'image/webp',
  },
  
  // 블로그 브랜딩: 높은 품질 유지
  blog: {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    quality: 0.95,
    fileType: 'image/webp',
  },
  
  // 로고/아이콘: 원본 유지
  logo: {
    preserveOriginalFormat: true,
    maxSizeMB: 0.5,
    quality: 1.0,
  },
} as const;

/**
 * 파일이 이미지인지 확인
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * WebP 변환이 필요한지 판단
 */
export function shouldConvertToWebP(file: File, context: keyof typeof CONVERSION_PRESETS = 'post'): boolean {
  // 이미 WebP인 경우
  if (file.type === 'image/webp') {
    return false;
  }
  
  // SVG는 변환하지 않음 (벡터 형식)
  if (file.type === 'image/svg+xml') {
    return false;
  }
  
  // GIF는 애니메이션 때문에 변환하지 않음
  if (file.type === 'image/gif') {
    return false;
  }
  
  // 로고/아이콘 컨텍스트에서 PNG는 유지
  if (context === 'logo' && file.type === 'image/png') {
    return false;
  }
  
  // 작은 PNG (50KB 미만)는 아이콘일 가능성이 높으므로 유지
  if (file.type === 'image/png' && file.size < 50 * 1024) {
    return false;
  }
  
  // 100KB 미만은 변환하지 않음 (효과가 미미함)
  if (file.size < 100 * 1024) {
    return false;
  }
  
  return true;
}

/**
 * 이미지를 WebP로 변환
 */
export async function convertToWebP(
  file: File,
  context: keyof typeof CONVERSION_PRESETS = 'post'
): Promise<File> {
  const preset = CONVERSION_PRESETS[context];
  
  // 변환이 필요없는 경우 원본 반환
  if (!shouldConvertToWebP(file, context)) {
    console.log(`[Image Conversion] Keeping original format for ${file.name} (${file.type}, ${formatFileSize(file.size)})`);
    return file;
  }
  
  try {
    console.log(`[Image Conversion] Converting ${file.name} to WebP...`);
    const startTime = Date.now();
    
    // browser-image-compression으로 변환
    const options = {
      maxSizeMB: preset.maxSizeMB || 2,
      maxWidthOrHeight: ('maxWidthOrHeight' in preset ? preset.maxWidthOrHeight : null) || 2400,
      useWebWorker: true,
      fileType: ('preserveOriginalFormat' in preset && preset.preserveOriginalFormat) ? file.type : 'image/webp',
      initialQuality: preset.quality || 0.85,
      alwaysKeepResolution: false,
    };
    
    const compressedFile = await imageCompression(file, options);
    
    // 새 파일명 생성 (확장자를 .webp로 변경)
    const newFileName = ('preserveOriginalFormat' in preset && preset.preserveOriginalFormat)
      ? file.name 
      : file.name.replace(/\.[^/.]+$/, '.webp');
    
    // File 객체 재생성 (이름 변경)
    const convertedFile = new File([compressedFile], newFileName, {
      type: compressedFile.type,
      lastModified: Date.now(),
    });
    
    const endTime = Date.now();
    const savedBytes = file.size - convertedFile.size;
    const savedPercentage = ((savedBytes / file.size) * 100).toFixed(1);
    
    console.log(
      `[Image Conversion] Success: ${file.name} → ${newFileName} | ` +
      `${formatFileSize(file.size)} → ${formatFileSize(convertedFile.size)} ` +
      `(saved ${formatFileSize(savedBytes)}, ${savedPercentage}%) | ` +
      `Time: ${endTime - startTime}ms`
    );
    
    return convertedFile;
  } catch (error) {
    console.error('[Image Conversion] Failed to convert image:', error);
    // 변환 실패 시 원본 반환
    return file;
  }
}

/**
 * 여러 이미지 일괄 변환
 */
export async function convertMultipleImages(
  files: File[],
  context: keyof typeof CONVERSION_PRESETS = 'post',
  onProgress?: (current: number, total: number) => void
): Promise<File[]> {
  const results: File[] = [];
  
  for (let i = 0; i < files.length; i++) {
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
    
    const file = files[i];
    if (isImageFile(file)) {
      const converted = await convertToWebP(file, context);
      results.push(converted);
    } else {
      results.push(file);
    }
  }
  
  return results;
}

/**
 * 이미지 리사이징 (썸네일 생성용)
 */
export async function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.85
): Promise<File> {
  try {
    const options = {
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      useWebWorker: true,
      fileType: file.type,
      initialQuality: quality,
    };
    
    const resizedFile = await imageCompression(file, options);
    
    // 파일명에 크기 정보 추가
    const nameParts = file.name.split('.');
    const extension = nameParts.pop();
    const baseName = nameParts.join('.');
    const newFileName = `${baseName}_${maxWidth}x${maxHeight}.${extension}`;
    
    return new File([resizedFile], newFileName, {
      type: resizedFile.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('[Image Resize] Failed to resize image:', error);
    return file;
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
 * CDN URL 생성 (Cloudflare 직접 연동)
 */
export function getCDNUrl(s3Key: string, options?: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'avif' | 'json';
}): string {
  // CDN 도메인 직접 사용 (백엔드 프록시 우회)
  const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_DOMAIN || 'cdn.codebase.blog';

  // S3 키 정리
  let cleanKey = s3Key;
  if (!cleanKey.startsWith('uploads/') && !cleanKey.startsWith('v2/')) {
    cleanKey = `uploads/${cleanKey}`;
  }

  // 기본 CDN URL
  let url = `https://${CDN_DOMAIN}/${cleanKey}`;

  // Cloudflare Image Resizing 파라미터 추가 (향후 확장용)
  // https://developers.cloudflare.com/images/image-resizing/url-format/
  if (options && (options.width || options.height || options.quality || options.format)) {
    const params = new URLSearchParams();

    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.quality) params.append('quality', options.quality.toString());
    if (options.format) params.append('format', options.format);

    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  return url;
}

/**
 * 이미지 최적화 추천 설정 가져오기
 */
export function getOptimizationRecommendation(
  file: File,
  context: keyof typeof CONVERSION_PRESETS = 'post'
): {
  shouldConvert: boolean;
  recommendedFormat: string;
  estimatedSaving: string;
  reason: string;
} {
  const shouldConvert = shouldConvertToWebP(file, context);
  
  if (!shouldConvert) {
    if (file.type === 'image/webp') {
      return {
        shouldConvert: false,
        recommendedFormat: 'WebP',
        estimatedSaving: '0%',
        reason: '이미 최적화된 WebP 형식입니다.',
      };
    }
    
    if (file.type === 'image/svg+xml') {
      return {
        shouldConvert: false,
        recommendedFormat: 'SVG',
        estimatedSaving: '0%',
        reason: '벡터 이미지는 변환하지 않습니다.',
      };
    }
    
    if (file.type === 'image/gif') {
      return {
        shouldConvert: false,
        recommendedFormat: 'GIF',
        estimatedSaving: '0%',
        reason: '애니메이션 GIF는 변환하지 않습니다.',
      };
    }
    
    if (file.size < 100 * 1024) {
      return {
        shouldConvert: false,
        recommendedFormat: file.type.split('/')[1].toUpperCase(),
        estimatedSaving: '0%',
        reason: '작은 파일은 변환 효과가 미미합니다.',
      };
    }
  }
  
  // WebP 변환 추천
  const estimatedSaving = file.type === 'image/jpeg' ? '25-35%' : '50-70%';
  
  return {
    shouldConvert: true,
    recommendedFormat: 'WebP',
    estimatedSaving,
    reason: `WebP로 변환하면 약 ${estimatedSaving}의 용량을 절감할 수 있습니다.`,
  };
}