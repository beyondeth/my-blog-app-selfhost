"use client";

import React, { useCallback } from 'react';
import { FiSearch } from 'react-icons/fi';
import SidebarSection from './SidebarSection';
import { mixpanel } from '@/lib/mixpanel';

interface SearchSectionProps {
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSearch: (query: string) => void;
  resultsCount?: number;
}

const SearchSection = React.memo(function SearchSection({
  searchQuery,
  onSearchQueryChange,
  onSearch,
  resultsCount = 0,
}: SearchSectionProps) {
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);

    // Mixpanel: 검색 이벤트 추적
    if (searchQuery.trim()) {
      mixpanel.track('Search Performed', {
        query: searchQuery.trim(),
        resultsCount: resultsCount,
      });
    }
  }, [onSearch, searchQuery, resultsCount]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    onSearchQueryChange(newQuery);
  }, [onSearchQueryChange]);

  return (
    <SidebarSection title="검색">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          placeholder="검색어를 입력하세요"
          className="flex-1 px-3 py-2.5 sm:py-2 text-sm sm:text-xs border border-gray-300 dark:border-gray-600 rounded-md sm:rounded-none focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600 focus:border-gray-400 dark:focus:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          className="px-4 py-2.5 sm:px-3 sm:py-2 border border-gray-300 text-gray-600 rounded-md sm:rounded-none hover:border-gray-400 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all min-w-[44px] flex items-center justify-center"
          aria-label="검색"
        >
          <FiSearch className="w-4 h-4" />
        </button>
      </form>
    </SidebarSection>
  );
});

export default SearchSection; 