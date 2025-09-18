'use client';

import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { useDMStore } from '@/stores/dmStore';

const ConversationSearch: React.FC = () => {
  const { conversationFilter, setSearchQuery } = useDMStore();
  const [localSearchValue, setLocalSearchValue] = useState(conversationFilter.searchQuery);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search update
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(localSearchValue);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [localSearchValue, setSearchQuery]);

  const handleClear = useCallback(() => {
    setLocalSearchValue('');
    setSearchQuery('');
    inputRef.current?.focus();
  }, [setSearchQuery]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  return (
    <div className="relative">
      <div
        className={`
          flex
          items-center
          gap-2
          px-3
          py-2
          bg-gray-50
          rounded-lg
          border-2
          transition-all
          duration-200
          ${isFocused
            ? 'border-blue-400 bg-white shadow-sm'
            : 'border-transparent'
          }
        `}
      >
        <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={localSearchValue}
          onChange={(e) => setLocalSearchValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="대화 검색..."
          className="
            flex-1
            bg-transparent
            outline-none
            text-sm
            text-gray-700
            placeholder-gray-400
          "
        />

        {localSearchValue && (
          <button
            onClick={handleClear}
            className="
              p-1
              rounded
              hover:bg-gray-200
              transition-colors
              flex-shrink-0
            "
            aria-label="Clear search"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        )}
      </div>

      {/* Search shortcuts hint */}
      {isFocused && (
        <div className="
          absolute
          top-full
          left-0
          right-0
          mt-1
          px-3
          py-2
          bg-white
          rounded-lg
          shadow-lg
          border
          border-gray-200
          text-xs
          text-gray-500
          z-10
        ">
          <div className="flex items-center justify-between">
            <span>Enter로 검색</span>
            <span>ESC로 초기화</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConversationSearch;