"use client";

import React, { useState } from 'react';
import { normalizeImageUrl } from '../../utils/imageUtils';

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
 * 최적화된 이미지 컴포넌트
 * 브라우저 네이티브 캐싱을 활용하여 성능 최적화
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
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = src ? normalizeImageUrl(src) : null;

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

  const handleError = () => {
    setHasError(true);
    onError?.();
  };

  const handleLoad = () => {
    setHasError(false);
    onLoad?.();
  };

  if (!normalizedSrc) {
    return (
      <div className={`relative overflow-hidden ${className}`} style={style}>
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800">
          <div className="text-center text-gray-500 dark:text-gray-400 p-4">
            <svg className="w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-xs sm:text-sm">이미지 없음</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`} style={style}>
      <img
        src={normalizedSrc}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        style={responsiveStyle}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        className={`block ${hasError ? 'opacity-50' : 'opacity-100'}`}
        onLoad={handleLoad}
        onError={handleError}
      />

      {hasError && (
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