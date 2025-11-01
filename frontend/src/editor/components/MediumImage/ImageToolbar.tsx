"use client";

/**
 * Image Toolbar
 * Medium 스타일 이미지 툴바 (검은 말풍선 스타일)
 *
 * 기능:
 * - 이미지 크기 버튼 (Small / Default / Full)
 * - Alt text 버튼
 * - 썸네일 선택 버튼 (선택사항)
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
  onAltTextClick: () => void;
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
  onAltTextClick,
  isThumbnail,
  onThumbnailToggle,
}) => {
  return (
    <div className="medium-image-toolbar-wrapper absolute -top-16 left-1/2 transform -translate-x-1/2 z-50">
      {/* 검은 말풍선 툴바 */}
      <div
        className={cn(
          'medium-image-toolbar',
          'flex items-center gap-3',
          'bg-gray-900 rounded-lg shadow-xl',
          'px-3 py-2',
          'border border-gray-700'
        )}
      >
        {/* 크기 버튼 그룹 */}
        <div className="size-buttons flex items-center gap-1 border-r border-gray-700 pr-3">
          {availableSizes.includes('small') && (
            <button
              type="button"
              onClick={() => onSizeChange('small')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors',
                currentSize === 'small'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
              title="작게 (300px)"
            >
              <SmallIcon />
            </button>
          )}

          {availableSizes.includes('default') && (
            <button
              type="button"
              onClick={() => onSizeChange('default')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors',
                currentSize === 'default'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
              title="기본 (680px)"
            >
              <DefaultIcon />
            </button>
          )}

          {availableSizes.includes('full') && (
            <button
              type="button"
              onClick={() => onSizeChange('full')}
              className={cn(
                'size-button',
                'p-1.5 rounded transition-colors',
                currentSize === 'full'
                  ? 'bg-emerald-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
              title="전체 (1000px)"
            >
              <FullIcon />
            </button>
          )}
        </div>

        {/* Alt text 버튼 */}
        <button
          type="button"
          onClick={onAltTextClick}
          className={cn(
            'alt-text-button',
            'px-3 py-1.5 rounded',
            'text-sm font-medium text-gray-300',
            'hover:bg-gray-800 hover:text-white',
            'transition-colors'
          )}
          title="Alt text (접근성)"
        >
          Alt text
        </button>

        {/* 썸네일 선택 버튼 (선택사항) */}
        {onThumbnailToggle && (
          <button
            type="button"
            onClick={onThumbnailToggle}
            className={cn(
              'thumbnail-button',
              'px-3 py-1.5 rounded',
              'text-sm font-medium',
              'border-l border-gray-700 pl-3 ml-2',
              'transition-colors',
              isThumbnail
                ? 'bg-emerald-600 text-white'
                : 'text-gray-300 hover:bg-gray-800 hover:text-white'
            )}
            title={isThumbnail ? '썸네일 해제' : '썸네일로 설정'}
          >
            {isThumbnail ? '⭐ 썸네일' : '☆ 썸네일'}
          </button>
        )}
      </div>

      {/* 말풍선 꼬리 (아래 방향) */}
      <div className="toolbar-arrow absolute left-1/2 transform -translate-x-1/2 top-full">
        <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-900" />
      </div>
    </div>
  );
};
