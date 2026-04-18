"use client";

import React, { useEffect } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

interface InfiniteScrollTriggerProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  totalPosts: number;
  currentPostsCount: number;
  onLoadMore: () => void;
  observerRoot?: Element | null;
  error?: Error | null;
  onRetry?: () => void;
  tone?: 'default' | 'harbor';
}

const InfiniteScrollTrigger = React.memo(function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  totalPosts,
  currentPostsCount,
  onLoadMore,
  observerRoot = null,
  error,
  onRetry,
  tone = 'default',
}: InfiniteScrollTriggerProps) {
  const isHarbor = tone === 'harbor';
  const mutedTextClass = isHarbor ? 'text-[#7B8794] dark:text-[#A9B4C2]' : 'text-gray-500';
  const retryButtonClass = isHarbor
    ? 'bg-[#264653] text-[#F9FBFD] hover:bg-[#2F5B6B] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#7DD1C0]'
    : 'bg-black text-white hover:bg-gray-800';
  const { targetRef } = useInfiniteScroll({
    threshold: 0.5,          // 50% 보이면 트리거
    rootMargin: '100px',     // 100px 전에 미리 로드
    root: observerRoot,
    enabled: hasNextPage && !isFetchingNextPage && !error,
    onLoadMore,
    hasMore: hasNextPage,
    loading: isFetchingNextPage,
  });

  // 에러 발생 시 자동 재시도 (3초 후)
  useEffect(() => {
    if (error && onRetry) {
      const timer = setTimeout(() => {
        onRetry();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [error, onRetry]);

  // 모든 포스트를 로드했을 때
  if (!hasNextPage && currentPostsCount > 0) {
    return (
      <div className={`text-center py-8 ${mutedTextClass} text-sm`}>
        <div className="inline-flex items-center gap-2">
          <svg 
            className="w-4 h-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <span>모든 포스트를 불러왔습니다 (총 {totalPosts}개)</span>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <svg 
            className="w-8 h-8 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className="text-sm">포스트를 불러오는 중 오류가 발생했습니다</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className={`px-4 py-2 text-sm rounded transition-colors ${retryButtonClass}`}
          >
            다시 시도
          </button>
        )}
        <p className={`text-xs ${mutedTextClass} mt-2`}>3초 후 자동으로 재시도합니다...</p>
      </div>
    );
  }

  if (hasNextPage) {
    return (
      <div
        className="relative h-px overflow-hidden"
        style={{ overflowAnchor: 'none' }}
        aria-hidden="true"
      >
        <div
          ref={targetRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          aria-hidden="true"
        />
      </div>
    );
  }

  return null;
});

export default InfiniteScrollTrigger;
