'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import type { MarkdownImageInfo } from '@/types/image-metadata.types';

interface MarkdownImageCardProps {
  image: MarkdownImageInfo;
  isActiveThumbnail: boolean;
  onSetThumbnail: (fileId: string) => void;
}

/**
 * 마크다운 모드용 이미지 카드 컴포넌트
 * 업로드 자산 확인 + 썸네일 지정 전용
 */
export function MarkdownImageCard({
  image,
  isActiveThumbnail,
  onSetThumbnail,
}: MarkdownImageCardProps) {
  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-2">
      {/* 기본 행: 이미지 썸네일 + 파일명 + 썸네일 버튼 */}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.url}
            alt={image.name || '업로드한 이미지'}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {image.name || '업로드한 이미지'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isActiveThumbnail ? 'default' : 'secondary'}
              onClick={() => onSetThumbnail(image.id)}
            >
              {isActiveThumbnail ? '썸네일 ✓' : '썸네일'}
            </Button>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 dark:text-gray-500">
        본문에서 이미지를 클릭하면 크기/캡션을 직접 수정할 수 있습니다.
      </p>
    </div>
  );
}

export default MarkdownImageCard;
