'use client';

import React from 'react';
import { FeedFilterType, FeedSortType } from '@/services/api/feed.service';
import { FiClock, FiTrendingUp } from 'react-icons/fi';

/**
 * FeedFilterTabs 컴포넌트 Props
 */
interface FeedFilterTabsProps {
  filter: FeedFilterType;
  sort: FeedSortType;
  onFilterChange: (filter: FeedFilterType) => void;
  onSortChange: (sort: FeedSortType) => void;
}

/**
 * 피드 필터/정렬 탭 컴포넌트
 *
 * @description 통합 피드에서 필터(전체/블로그/커뮤니티)와 정렬(최신/인기) 선택
 */
export default function FeedFilterTabs({
  filter,
  sort,
  onFilterChange,
  onSortChange,
}: FeedFilterTabsProps) {
  const filters: { value: FeedFilterType; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'blog', label: '블로그' },
    { value: 'community', label: '커뮤니티' },
  ];

  const sorts: { value: FeedSortType; label: string; icon: React.ReactNode }[] = [
    { value: 'recent', label: '최신', icon: <FiClock className="w-4 h-4" /> },
    { value: 'hot', label: '인기', icon: <FiTrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="flex items-center justify-between mb-6 pb-3 border-b border-gray-200 dark:border-gray-800">
      {/* 필터 탭 */}
      <div className="flex items-center gap-1">
        {filters.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              filter === value
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 정렬 옵션 */}
      <div className="flex items-center gap-1">
        {sorts.map(({ value, label, icon }) => (
          <button
            key={value}
            onClick={() => onSortChange(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
              sort === value
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {icon}
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
