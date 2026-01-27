'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import type { ImageSize, MarkdownImageInfo } from '@/types/image-metadata.types';

interface MarkdownImageCardProps {
  image: MarkdownImageInfo;
  isActiveThumbnail: boolean;
  onInsert: (image: MarkdownImageInfo) => void;
  onSetThumbnail: (fileId: string) => void;
}

const SIZE_OPTIONS: { value: ImageSize; label: string }[] = [
  { value: 'default', label: '기본' },
  { value: 'small', label: '작게' },
  { value: 'medium', label: '중간' },
  { value: 'full', label: '전체폭' },
];

/**
 * 마크다운 모드용 이미지 카드 컴포넌트
 * 크기 및 Caption 설정 후 본문에 삽입 가능
 */
export function MarkdownImageCard({
  image,
  isActiveThumbnail,
  onInsert,
  onSetThumbnail,
}: MarkdownImageCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [size, setSize] = useState<ImageSize>(image.size || 'default');
  const [caption, setCaption] = useState(image.caption || '');

  const handleInsert = useCallback(() => {
    onInsert({
      ...image,
      size,
      caption: caption.trim() || undefined,
    });
  }, [image, size, caption, onInsert]);

  const handleSizeChange = useCallback((value: string) => {
    setSize(value as ImageSize);
  }, []);

  const handleCaptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCaption(e.target.value);
  }, []);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  return (
    <div className="rounded-lg border border-gray-100 dark:border-gray-800 p-2 space-y-2">
      {/* 기본 행: 이미지 썸네일 + 파일명 + 버튼 */}
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
              variant="outline"
              className="gap-1.5"
              onClick={handleInsert}
            >
              <FileText className="h-3.5 w-3.5" />
              삽입
            </Button>
            <Button
              type="button"
              size="sm"
              variant={isActiveThumbnail ? 'default' : 'secondary'}
              onClick={() => onSetThumbnail(image.id)}
            >
              {isActiveThumbnail ? '썸네일 ✓' : '썸네일'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="gap-1 px-2"
              onClick={toggleExpand}
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5" />
                  <span className="text-xs">접기</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5" />
                  <span className="text-xs">옵션</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* 확장 영역: 크기 및 Caption 설정 */}
      {isExpanded && (
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">크기</span>
            <Select value={size} onValueChange={handleSizeChange}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIZE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 w-12 flex-shrink-0">설명</span>
            <Input
              type="text"
              value={caption}
              onChange={handleCaptionChange}
              placeholder="이미지 설명 (선택)"
              className="h-8 text-xs flex-1"
            />
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            옵션 설정 후 &apos;삽입&apos; 버튼을 눌러 본문에 추가하세요.
          </p>
        </div>
      )}
    </div>
  );
}

export default MarkdownImageCard;
