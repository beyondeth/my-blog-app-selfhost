'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Tag } from 'lucide-react';
import FlairBadge from './FlairBadge';
import type { CommunityFlair } from '@/types/community';
import { FlairType } from '@/types/community';

interface FlairsListProps {
  /** 커뮤니티에서 가져온 플레어 목록 */
  flairs?: CommunityFlair[];
  /** 플레어 클릭 시 필터링 콜백 */
  onFlairClick?: (flairId: string) => void;
  /** 현재 선택된 플레어 ID */
  selectedFlairId?: string | null;
  className?: string;
  showHeader?: boolean;
  headerTitle?: string;
}

/**
 * 플레어 목록 컴포넌트
 * 커뮤니티에서 사용 가능한 게시물 플레어를 표시
 */
const FlairsList = React.memo(function FlairsList({
  flairs,
  onFlairClick,
  selectedFlairId,
  className,
  showHeader = true,
  headerTitle = '플레어',
}: FlairsListProps) {
  // 게시물 플레어만 필터링하고 활성화된 것만 표시
  const postFlairs = flairs?.filter(
    (flair) => flair.type === FlairType.POST && flair.isEnabled
  ) || [];

  // 플레어가 없는 경우 표시하지 않음
  if (postFlairs.length === 0) {
    return null;
  }

  // displayOrder로 정렬
  const sortedFlairs = [...postFlairs].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  return (
    <div
      className={cn(
        'bg-white dark:bg-[rgb(38,38,38)] rounded-xl border border-gray-200 dark:border-gray-700 p-5',
        className
      )}
    >
      {/* 헤더 */}
      {showHeader && (
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <Tag className="w-4 h-4 text-gray-500 dark:text-[#C7D1DD]" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {headerTitle}
          </h3>
        </div>
      )}

      {/* 플레어 목록 */}
      <div className="flex flex-wrap gap-2">
        {sortedFlairs.map((flair) => {
          const isSelected = selectedFlairId === flair.id;

          return (
            <button
              key={flair.id}
              onClick={() => onFlairClick?.(flair.id)}
              className={cn(
                'transition-all',
                isSelected && 'ring-2 ring-offset-1 ring-blue-500 rounded-full',
                onFlairClick && 'cursor-pointer hover:opacity-80'
              )}
              disabled={!onFlairClick}
            >
              <FlairBadge flair={flair} size="md" />
            </button>
          );
        })}
      </div>

      {/* 선택된 플레어 초기화 버튼 */}
      {selectedFlairId && onFlairClick && (
        <button
          onClick={() => onFlairClick('')}
          className="mt-3 text-xs text-gray-500 hover:text-gray-700 dark:text-[#C7D1DD] dark:hover:text-[#E6EDF3] transition-colors"
        >
          필터 초기화
        </button>
      )}
    </div>
  );
});

export default FlairsList;
