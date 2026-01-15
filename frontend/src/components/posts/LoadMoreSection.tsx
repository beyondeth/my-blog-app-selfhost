"use client";

import React from 'react';

interface LoadMoreSectionProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  totalPosts: number;
  allPostsCount: number;
  onLoadMore: () => void;
  accentColor?: string;
  accentSoftColor?: string;
}

const LoadMoreSection = React.memo(function LoadMoreSection({
  hasNextPage,
  isFetchingNextPage,
  totalPosts,
  allPostsCount,
  onLoadMore,
  accentColor,
  accentSoftColor,
}: LoadMoreSectionProps) {
  if (hasNextPage) {
    return (
      <div className="text-center py-8">
        <button
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="px-6 py-2 text-sm border rounded-full transition-colors disabled:opacity-50 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800"
          style={{
            borderColor: accentColor || undefined,
            color: accentColor || undefined,
            backgroundColor: accentSoftColor || 'transparent',
          }}
        >
          {isFetchingNextPage ? '로딩 중...' : '더 많은 포스트 보기'}
        </button>
      </div>
    );
  }

  if (allPostsCount > 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        모든 포스트를 불러왔습니다. (총 {totalPosts}개)
      </div>
    );
  }

  return null;
});

export default LoadMoreSection; 
