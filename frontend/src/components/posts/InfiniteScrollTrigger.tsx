"use client";

import React, { useEffect } from 'react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { PostSkeletonWithShimmer } from './PostSkeleton';

interface InfiniteScrollTriggerProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  totalPosts: number;
  currentPostsCount: number;
  onLoadMore: () => void;
  error?: Error | null;
  onRetry?: () => void;
}

const InfiniteScrollTrigger = React.memo(function InfiniteScrollTrigger({
  hasNextPage,
  isFetchingNextPage,
  totalPosts,
  currentPostsCount,
  onLoadMore,
  error,
  onRetry,
}: InfiniteScrollTriggerProps) {
  const { targetRef } = useInfiniteScroll({
    threshold: 0.5,          // 50% 보이면 트리거
    rootMargin: '100px',     // 100px 전에 미리 로드
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
      <div className="text-center py-8 text-gray-500 text-sm">
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
            className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 transition-colors"
          >
            다시 시도
          </button>
        )}
        <p className="text-xs text-gray-500 mt-2">3초 후 자동으로 재시도합니다...</p>
      </div>
    );
  }

  // 로딩 중
  if (isFetchingNextPage) {
    return (
      <div className="py-4">
        <PostSkeletonWithShimmer count={3} />
        <div className="text-center py-4 text-gray-500 text-sm">
          더 많은 포스트를 불러오는 중...
        </div>
      </div>
    );
  }

  // 무한 스크롤 트리거 (보이지 않는 센티널 요소)
  if (hasNextPage) {
    return (
      <>
        {/* 센티널 요소 - 이 요소가 뷰포트에 들어오면 다음 페이지 로드 */}
        <div 
          ref={targetRef}
          className="h-10 flex items-center justify-center"
          aria-hidden="true"
        >
          {/* 디버깅용 - 개발 모드에서만 보이도록 */}
          {process.env.NODE_ENV === 'development' && (
            <span className="text-xs text-gray-400">
              [스크롤 트리거 영역]
            </span>
          )}
        </div>
        
        {/* 사용자가 빠르게 스크롤할 때를 대비한 수동 로드 옵션 */}
        <div className="text-center py-4">
          <button
            onClick={onLoadMore}
            disabled={isFetchingNextPage}
            className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            수동으로 더 불러오기
          </button>
        </div>
      </>
    );
  }

  return null;
});

export default InfiniteScrollTrigger;