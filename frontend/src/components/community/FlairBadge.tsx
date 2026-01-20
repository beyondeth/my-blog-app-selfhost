'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { CommunityFlair } from '@/types/community';

interface FlairBadgeProps {
  flair: CommunityFlair;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

/**
 * 커뮤니티 말머리 배지 컴포넌트
 * 게시물이나 사용자에 할당된 말머리를 표시
 */
const FlairBadge = React.memo(function FlairBadge({
  flair,
  size = 'sm',
  className,
}: FlairBadgeProps) {
  // 말머리가 비활성화되어 있으면 렌더링하지 않음
  if (!flair.isEnabled) {
    return null;
  }

  // 기본 색상 (커뮤니티에서 지정하지 않은 경우)
  const backgroundColor = flair.backgroundColor || '#e5e7eb';
  const textColor = flair.textColor || '#374151';

  const sizeClasses =
    size === 'xs'
      ? 'px-1.5 py-[2px] text-[11px]'
      : size === 'sm'
        ? 'px-2 py-[3px] text-xs'
        : 'px-2.5 py-[4px] text-sm';

  return (
    <span
      className={cn(
        'inline-flex max-w-fit items-center justify-center whitespace-nowrap rounded-full font-medium leading-none',
        sizeClasses,
        className
      )}
      style={{
        backgroundColor,
        color: textColor,
      }}
    >
      {flair.name}
    </span>
  );
});

export default FlairBadge;
