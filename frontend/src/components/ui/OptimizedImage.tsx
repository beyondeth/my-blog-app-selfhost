"use client";

import React from 'react';
import { useImageLoader, normalizeImageUrl } from '../../utils/imageUtils';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
  sizes?: string;
  aspectRatio?: number;
}

/**
 * TanStack Query를 사용한 최적화된 이미지 컴포넌트
 * Context7 반응형 이미지 모범 사례를 적용하여 모바일 최적화
 */
export default function OptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  style = {},
  priority = false,
  onLoad,
  onError,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  aspectRatio,
}: OptimizedImageProps) {
  const normalizedSrc = src ? normalizeImageUrl(src) : null;
  
  // 디버깅: 이미지 URL 변환 과정 로그
  React.useEffect(() => {
    if (src && !src.includes('youtube') && !src.includes('ytimg')) {
      console.log('[OptimizedImage] Image URL processing:', {
        original: src,
        normalized: normalizedSrc,
        alt: alt,
        isDownloadUrl: src.includes('/download'),
        isProxyUrl: src.includes('/proxy/')
      });
    }
  }, [src, normalizedSrc, alt]);
  
  const { isLoading, error, loadedUrl } = useImageLoader(normalizedSrc);

  // 콜백 메모이제이션으로 불필요한 재렌더링 방지
  const memoizedOnLoad = React.useCallback(() => {
    if (loadedUrl && onLoad) {
      onLoad();
    }
  }, [loadedUrl, onLoad]);

  const memoizedOnError = React.useCallback(() => {
    if (error && onError) {
      onError();
    }
  }, [error, onError]);

  React.useEffect(() => {
    memoizedOnLoad();
  }, [memoizedOnLoad]);

  React.useEffect(() => {
    memoizedOnError();
  }, [memoizedOnError]);

  // 반응형 스타일 계산
  const responsiveStyle: React.CSSProperties = {
    ...style,
    width: width ? `${width}px` : '100%',
    height: height ? `${height}px` : aspectRatio ? 'auto' : '100%',
    maxWidth: '100%',
    objectFit: 'cover',
    // 종횡비 유지
    ...(aspectRatio && {
      aspectRatio: aspectRatio.toString(),
    }),
  };

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <img
        src={normalizedSrc || ''}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        style={responsiveStyle}
        loading={priority ? 'eager' : 'lazy'}
        className={`block transition-opacity duration-300 ${
          error ? 'opacity-50' : isLoading ? 'opacity-0' : 'opacity-100'
        }`}
        onError={() => error && onError?.()}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="animate-pulse">
            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-center text-gray-500 dark:text-gray-400 p-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs sm:text-sm">이미지를 불러올 수 없습니다</p>
          </div>
        </div>
      )}
    </div>
  );
} 