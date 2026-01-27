'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ImageSize } from '@/types/image-metadata.types';
import { cn } from '@/lib/utils';


export interface VisualMarkdownImageBlockProps {
  url: string;
  alt: string;
  size: ImageSize;
  caption?: string;
  fileId?: string;
  onChange: (changes: { size?: ImageSize; caption?: string }) => void;
  onRemove: () => void;
  isThumbnail?: boolean;
  onThumbnailToggle?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

const AVAILABLE_SIZES: ImageSize[] = ['small', 'medium', 'default', 'full'];
const SIZE_LABELS: Record<ImageSize, string> = {
  small: '작게',
  medium: '중간',
  default: '기본',
  full: '전체',
};
const SIZE_BOX_CLASS: Record<ImageSize, string> = {
  small: 'w-3 h-3',
  medium: 'w-4 h-3',
  default: 'w-5 h-3',
  full: 'w-6 h-3',
};

export function VisualMarkdownImageBlock({
  url,
  alt,
  size,
  caption,
  onChange,
  onRemove,
}: VisualMarkdownImageBlockProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [localCaption, setLocalCaption] = useState(caption || '');
  const containerRef = useRef<HTMLDivElement>(null);

  // 외부 click outside 감지하여 포커스 해제
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleCaptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalCaption(e.target.value);
    onChange({ caption: e.target.value });
  };

  // size에 따른 최대 너비 스타일 설정
  const getSizeStyle = () => {
    switch (size) {
      case 'small': return 'max-w-[300px]';
      case 'medium': return 'max-w-[500px]';
      case 'full': return 'max-w-[1000px]';
      default: return 'max-w-[680px]'; // default
    }
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "visual-markdown-image-block relative group my-6 mx-auto",
        getSizeStyle(),
        isFocused ? "ring-2 ring-blue-500 rounded-lg" : ""
      )}
      onClick={() => setIsFocused(true)}
    >
      {/* 툴바 (포커스되었을 때만 표시) */}
      {isFocused && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1">
            <div className="flex items-center gap-1">
              {AVAILABLE_SIZES.map((option) => {
                const isActive = size === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange({ size: option });
                    }}
                    aria-label={`${SIZE_LABELS[option]} 크기`}
                    title={`${SIZE_LABELS[option]} 크기`}
                    className={cn(
                      'p-1 rounded-md border transition-colors',
                      isActive
                        ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                        : 'border-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    )}
                  >
                    <span
                      className={cn(
                        'block rounded-sm border',
                        SIZE_BOX_CLASS[option],
                        isActive
                          ? 'border-current bg-current'
                          : 'border-gray-400 dark:border-gray-500'
                      )}
                    />
                  </button>
                );
              })}
            </div>
            <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-2" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 px-2 py-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              삭제
            </button>
          </div>
        </div>
      )}

      {/* 이미지 렌더링 */}
      <figure className="m-0 w-full">
        <img
          src={url}
          alt={alt}
          className="w-full h-auto rounded-lg shadow-sm"
          data-size={size}
        />
        {/* Caption 입력란 */}
        <div className="mt-2 text-center">
          <input
            type="text"
            value={localCaption}
            onChange={handleCaptionChange}
            placeholder="이미지 캡션 (optional)"
            className="w-full text-center text-sm text-gray-500 dark:text-gray-400 bg-transparent border-none focus:ring-0 focus:outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
          />
        </div>
      </figure>
    </div>
  );
}
