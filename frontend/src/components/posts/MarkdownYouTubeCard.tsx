'use client';

import React from 'react';
import { Button } from '@/components/ui/button';

interface MarkdownYouTubeCardProps {
  videoId: string;
  isActiveThumbnail: boolean;
  onSetThumbnail: (videoId: string) => void;
}

export function MarkdownYouTubeCard({
  videoId,
  isActiveThumbnail,
  onSetThumbnail,
}: MarkdownYouTubeCardProps) {
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-2">
      <div className="flex items-center gap-3">
        <div className="h-16 w-28 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={`YouTube ${videoId}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-white text-xs font-semibold bg-black/50 rounded-full px-2 py-0.5">
              YouTube
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
            {watchUrl}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={isActiveThumbnail ? 'default' : 'secondary'}
              onClick={() => onSetThumbnail(videoId)}
            >
              {isActiveThumbnail ? '썸네일 ✓' : '썸네일'}
            </Button>
            <a
              href={watchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
            >
              영상 열기
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MarkdownYouTubeCard;
