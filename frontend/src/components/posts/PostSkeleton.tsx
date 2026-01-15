"use client";

import React from 'react';

interface PostSkeletonProps {
  count?: number;
  tone?: 'default' | 'harbor';
}

const PostSkeleton = React.memo(function PostSkeleton({ count = 3, tone = 'default' }: PostSkeletonProps) {
  const isHarbor = tone === 'harbor';
  const borderClass = isHarbor ? 'border-[#D9E0EA] dark:border-[#2A3645]' : 'border-gray-200 dark:border-gray-700';
  const blockClass = isHarbor ? 'bg-[#D9E0EA] dark:bg-[#2A3645]' : 'bg-gray-200 dark:bg-gray-700';
  const separatorClass = isHarbor ? 'text-[#D9E0EA] dark:text-[#2A3645]' : 'text-gray-300 dark:text-gray-600';
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`skeleton-${index}`}
          className={`border-t ${borderClass} first:border-t-0 py-4 sm:py-6 animate-pulse`}
          aria-label="로딩 중..."
        >
          {/* 헤더 영역 */}
          <div className="flex items-center gap-2 mb-3">
            {/* 블로그 이름 스켈레톤 */}
            <div className={`h-4 w-24 ${blockClass} rounded`}></div>
            <span className={separatorClass}>·</span>
            {/* 날짜 스켈레톤 */}
            <div className={`h-4 w-20 ${blockClass} rounded`}></div>
          </div>

          {/* 제목 스켈레톤 */}
          <div className={`h-7 ${blockClass} rounded w-3/4 mb-3`}></div>

          {/* 설명 스켈레톤 (2줄) */}
          <div className="space-y-2 mb-4">
            <div className={`h-4 ${blockClass} rounded w-full`}></div>
            <div className={`h-4 ${blockClass} rounded w-5/6`}></div>
          </div>

          {/* 태그와 상호작용 영역 */}
          <div className="flex items-center justify-between">
            {/* 태그 스켈레톤 */}
            <div className="flex gap-2">
              <div className={`h-6 w-16 ${blockClass} rounded`}></div>
              <div className={`h-6 w-20 ${blockClass} rounded`}></div>
              <div className={`h-6 w-14 ${blockClass} rounded`}></div>
            </div>

            {/* 상호작용 버튼 스켈레톤 */}
            <div className="flex items-center gap-4">
              <div className={`h-8 w-16 ${blockClass} rounded`}></div>
              <div className={`h-8 w-16 ${blockClass} rounded`}></div>
            </div>
          </div>
        </article>
      ))}
    </>
  );
});

// Shimmer 효과를 위한 고급 스켈레톤
export const PostSkeletonWithShimmer = React.memo(function PostSkeletonWithShimmer({
  count = 3,
  tone = 'default',
}: PostSkeletonProps) {
  const isHarbor = tone === 'harbor';
  const borderClass = isHarbor ? 'border-[#D9E0EA] dark:border-[#2A3645]' : 'border-gray-200 dark:border-gray-700';
  const separatorClass = isHarbor ? 'text-[#D9E0EA] dark:text-[#2A3645]' : 'text-gray-300 dark:text-gray-600';
  const shimmerStyle = isHarbor
    ? ({
        '--skeleton-start': '#D9E0EA',
        '--skeleton-mid': '#EEF3F8',
        '--skeleton-end': '#D9E0EA',
        '--skeleton-dark-start': '#2A3645',
        '--skeleton-dark-mid': '#1A232E',
        '--skeleton-dark-end': '#2A3645',
      } as React.CSSProperties)
    : undefined;
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <article
          key={`shimmer-skeleton-${index}`}
          className={`border-t ${borderClass} first:border-t-0 py-4 sm:py-6`}
          aria-label="로딩 중..."
          style={shimmerStyle}
        >
          {/* 헤더 영역 */}
          <div className="flex items-center gap-2 mb-3">
            <div className="skeleton-shimmer h-4 w-24 rounded"></div>
            <span className={separatorClass}>·</span>
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
            var(--skeleton-start, #e5e7eb) 0%,
            var(--skeleton-mid, #f3f4f6) 50%,
            var(--skeleton-end, #e5e7eb) 100%
          );
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        :global(.dark) .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            var(--skeleton-dark-start, #374151) 0%,
            var(--skeleton-dark-mid, #4b5563) 50%,
            var(--skeleton-dark-end, #374151) 100%
          );
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
