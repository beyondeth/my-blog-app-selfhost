"use client";

/**
 * Image Toolbar
 * Medium 스타일 이미지 툴바 (검은 말풍선 스타일)
 *
 * 기능:
 * - 이미지 크기 버튼 (Small / Default / Full)
 * - Alt text 버튼
 * - 썸네일 선택 버튼
 */

import React from 'react';
import { ImageSize } from '../../extensions/MediumStyleImage.extension';
import { cn } from '@/lib/utils';

// ============================================
// 타입 정의 (Type Definitions)
// ============================================
interface ImageToolbarProps {
  currentSize: ImageSize;
  availableSizes: ImageSize[];
  onSizeChange: (size: ImageSize) => void;
  isThumbnail?: boolean;
  onThumbnailToggle?: () => void;
}

// ============================================
// 크기 버튼 아이콘 SVG
// ============================================
const SmallIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    {/* Small: 작은 사각형 */}
    <rect x="6" y="6" width="8" height="8" rx="1" fill="currentColor" />
    <rect x="6" y="6" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const MediumIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    {/* Medium: 중간-작은 사각형 */}
    <rect x="4" y="5.5" width="12" height="9" rx="1" fill="currentColor" />
    <rect x="4" y="5.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const DefaultIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    {/* Default: 중간 사각형 */}
    <rect x="3" y="5" width="14" height="10" rx="1" fill="currentColor" />
    <rect x="3" y="5" width="14" height="10" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

const FullIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 20 20"
    fill="currentColor"
    className={className}
  >
    {/* Full: 큰 사각형 */}
    <rect x="2" y="4" width="16" height="12" rx="1" fill="currentColor" />
    <rect x="2" y="4" width="16" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" fill="none" />
  </svg>
);

// ============================================
// 메인 컴포넌트 (Main Component)
// ============================================
export const ImageToolbar: React.FC<ImageToolbarProps> = ({
  currentSize,
  availableSizes,
  onSizeChange,
  isThumbnail = false,
  onThumbnailToggle,
}) => {
  return (
    // Option 2: absolute 포지션으로 이미지 위에 오버레이 (레이아웃 점프 방지)
    <div className="medium-image-toolbar-wrapper absolute top-2 left-1/2 -translate-x-1/2 z-10 flex justify-center">
      {/* 흰색 배경의 툴바 */}
      <div
        className={cn(
          'medium-image-toolbar',
          'inline-flex items-center gap-3',
          'bg-white/95 backdrop-blur-sm rounded-lg shadow-lg',
          'px-4 py-2',
          'border border-gray-200'
        )}
      >
        {/* 크기 버튼 그룹 */}
        <div className="size-buttons flex items-center gap-1 border-r border-gray-300 pr-3">
          {availableSizes.includes('small') && (
            <button
              type="button"
              onClick={() => onSizeChange('small')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors relative',
                currentSize === 'small'
                  ? 'bg-orange-400 text-gray-800 ring-2 ring-orange-200 ring-offset-1'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              title="작게 (300px)"
            >
              <SmallIcon />
              {currentSize === 'small' && (
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <path d="M2 6L4.5 8.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              )}
            </button>
          )}

          {availableSizes.includes('medium') && (
            <button
              type="button"
              onClick={() => onSizeChange('medium')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors relative',
                currentSize === 'medium'
                  ? 'bg-orange-400 text-gray-800 ring-2 ring-orange-200 ring-offset-1'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              title="중간 (500px)"
            >
              <MediumIcon />
              {currentSize === 'medium' && (
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <path d="M2 6L4.5 8.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              )}
            </button>
          )}

          {availableSizes.includes('default') && (
            <button
              type="button"
              onClick={() => onSizeChange('default')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors relative',
                currentSize === 'default'
                  ? 'bg-orange-400 text-gray-800 ring-2 ring-orange-200 ring-offset-1'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              title="기본 (680px)"
            >
              <DefaultIcon />
              {currentSize === 'default' && (
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <path d="M2 6L4.5 8.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              )}
            </button>
          )}

          {availableSizes.includes('full') && (
            <button
              type="button"
              onClick={() => onSizeChange('full')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors relative',
                currentSize === 'full'
                  ? 'bg-orange-400 text-gray-800 ring-2 ring-orange-200 ring-offset-1'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              )}
              title="전체 (1000px)"
            >
              <FullIcon />
              {currentSize === 'full' && (
                <div className="absolute -top-1 -right-1 bg-orange-500 rounded-full p-0.5">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="white">
                    <path d="M2 6L4.5 8.5L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              )}
            </button>
          )}
        </div>

        {/* 썸네일 선택 버튼 */}
        {onThumbnailToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onThumbnailToggle();
            }}
            className={cn(
              'thumbnail-button',
              'px-3 py-1.5 rounded',
              'text-sm font-medium',
              'border-l border-gray-300 pl-3 ml-2',
              'transition-colors',
              isThumbnail
                ? 'bg-orange-400 text-gray-700'
                : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
            )}
            title={isThumbnail
              ? '썸네일 해제'
              : '썸네일로 설정'
            }
          >
            <span className="relative">
              {isThumbnail ? '⭐ 썸네일' : '☆ 썸네일'}
              {isThumbnail && (
                <div className="absolute -top-2 -right-2 bg-orange-500 rounded-full p-0.5">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                    <path d="M1.5 5L3.5 7L8.5 2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
