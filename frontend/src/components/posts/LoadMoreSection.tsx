"use client";

import React from 'react';

interface LoadMoreSectionProps {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  totalPosts: number;
  allPostsCount: number;
  onLoadMore: () => void;
}

const LoadMoreSection = React.memo(function LoadMoreSection({
  hasNextPage,
  isFetchingNextPage,
  totalPosts,
  allPostsCount,
  onLoadMore,
}: LoadMoreSectionProps) {
  if (hasNextPage) {
    return (
      <div className="text-center py-8">
        <button
          onClick={onLoadMore}
          disabled={isFetchingNextPage}
          className="px-6 py-2 text-sm border border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors disabled:opacity-50"
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