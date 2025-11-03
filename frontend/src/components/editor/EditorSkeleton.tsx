"use client";

import React from "react";

/**
 * Editor Skeleton Component
 * 에디터 로딩 시 표시되는 단순한 스켈레톤 UI
 */

interface EditorSkeletonProps {
  height?: string;
}

export const EditorSkeleton: React.FC<EditorSkeletonProps> = ({
  height = "750px",
}) => {
  return (
    <div
      className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
      style={{ height }}
      data-ui-effect="elevated-surface"
      data-elevation="floating-editor"
      data-focus-mode="writing"
    >
      {/* 툴바 영역 */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-2">
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>

      {/* 컨텐츠 영역 */}
      <div className="p-6 space-y-4">
        {/* 텍스트 라인들 */}
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-4/5" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-3/4" />

        {/* 간격 */}
        <div className="h-4" />

        {/* 두 번째 문단 */}
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />

        {/* 이미지 플레이스홀더 */}
        <div className="h-40 bg-gray-100 dark:bg-gray-800 rounded-lg" />

        {/* 세 번째 문단 */}
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-full" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded w-4/5" />
      </div>
    </div>
  );
};

/**
 * Shimmer 효과를 위한 CSS 애니메이션
 */
export const EditorSkeletonWithShimmer: React.FC<EditorSkeletonProps> = (props) => {
  return (
    <div className="relative overflow-hidden">
      <EditorSkeleton {...props} />
    </div>
  );
};