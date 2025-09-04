"use client";

import React from 'react';

interface PostSkeletonProps {
  count?: number;
}

const PostSkeleton = React.memo(function PostSkeleton({ count = 3 }: PostSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article 
          key={`skeleton-${index}`}
          className="border-t border-gray-200 first:border-t-0 py-4 sm:py-6 animate-pulse"
          aria-label="로딩 중..."
        >
          {/* 헤더 영역 */}
          <div className="flex items-center gap-2 mb-3">
            {/* 블로그 이름 스켈레톤 */}
            <div className="h-4 w-24 bg-gray-200 rounded"></div>
            <span className="text-gray-300">·</span>
            {/* 날짜 스켈레톤 */}
            <div className="h-4 w-20 bg-gray-200 rounded"></div>
          </div>

          {/* 제목 스켈레톤 */}
          <div className="h-7 bg-gray-200 rounded w-3/4 mb-3"></div>

          {/* 설명 스켈레톤 (2줄) */}
          <div className="space-y-2 mb-4">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>

          {/* 태그와 상호작용 영역 */}
          <div className="flex items-center justify-between">
            {/* 태그 스켈레톤 */}
            <div className="flex gap-2">
              <div className="h-6 w-16 bg-gray-200 rounded"></div>
              <div className="h-6 w-20 bg-gray-200 rounded"></div>
              <div className="h-6 w-14 bg-gray-200 rounded"></div>
            </div>
            
            {/* 상호작용 버튼 스켈레톤 */}
            <div className="flex items-center gap-4">
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
              <div className="h-8 w-16 bg-gray-200 rounded"></div>
            </div>
          </div>
        </article>
      ))}
    </>
  );
});

// Shimmer 효과를 위한 고급 스켈레톤
export const PostSkeletonWithShimmer = React.memo(function PostSkeletonWithShimmer({ 
  count = 3 
}: PostSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article 
          key={`shimmer-skeleton-${index}`}
          className="border-t border-gray-200 first:border-t-0 py-4 sm:py-6"
          aria-label="로딩 중..."
        >
          {/* 헤더 영역 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="skeleton-shimmer h-4 w-24 rounded"></div>
            <span className="text-gray-300">·</span>
            <div className="skeleton-shimmer h-4 w-20 rounded"></div>
          </div>

          {/* 제목 스켈레톤 */}
          <div className="skeleton-shimmer h-7 rounded w-3/4 mb-3"></div>

          {/* 설명 스켈레톤 */}
          <div className="space-y-2 mb-4">
            <div className="skeleton-shimmer h-4 rounded w-full"></div>
            <div className="skeleton-shimmer h-4 rounded w-5/6"></div>
          </div>

          {/* 태그와 상호작용 영역 */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <div className="skeleton-shimmer h-6 w-16 rounded"></div>
              <div className="skeleton-shimmer h-6 w-20 rounded"></div>
              <div className="skeleton-shimmer h-6 w-14 rounded"></div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="skeleton-shimmer h-8 w-16 rounded"></div>
              <div className="skeleton-shimmer h-8 w-16 rounded"></div>
            </div>
          </div>
        </article>
      ))}

      <style jsx>{`
        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            #f0f0f0 0%,
            #f8f8f8 50%,
            #f0f0f0 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% {
            background-position: -100% 0;
          }
          100% {
            background-position: 100% 0;
          }
        }
      `}</style>
    </>
  );
});

export default PostSkeleton;