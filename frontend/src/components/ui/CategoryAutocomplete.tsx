"use client";

import React, { useState, useMemo } from 'react';
import { Input } from './input';
import { useUserCategories } from '@/hooks/usePosts';

interface CategoryAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * 카테고리 자동완성 드롭다운 컴포넌트
 *
 * @description
 * 사용자가 이전에 작성한 카테고리 목록을 자동완성으로 제공합니다.
 * 새로운 카테고리도 직접 입력할 수 있습니다.
 *
 * @param value - 현재 카테고리 값
 * @param onChange - 값 변경 핸들러
 * @param disabled - 비활성화 여부
 * @param placeholder - 플레이스홀더 텍스트
 * @param className - 추가 CSS 클래스
 */
const CategoryAutocomplete = React.forwardRef<HTMLInputElement, CategoryAutocompleteProps>(({
  value,
  onChange,
  onBlur,
  onFocus,
  disabled,
  placeholder = " 카테고리 입력",
  className,
}, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const { data: categories = [], isLoading } = useUserCategories();

  // 입력값으로 필터링된 카테고리 목록
  const filteredCategories = useMemo(() => {
    if (!inputValue.trim()) return categories;
    const lowerInput = inputValue.toLowerCase();
    return categories.filter(cat => cat.toLowerCase().includes(lowerInput));
  }, [categories, inputValue]);

  // 드롭다운 표시 여부
  const showDropdown = isFocused && filteredCategories.length > 0;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) {
      onFocus();
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // 드롭다운 클릭 시에는 blur를 무시하기 위해 setTimeout 사용
    setTimeout(() => {
      setIsFocused(false);
      if (onBlur) {
        onBlur();
      }
    }, 200);
  };

  const selectCategory = (category: string) => {
    setInputValue(category);
    onChange(category);
    setIsFocused(false);
  };

  return (
    <div className="relative">
      <Input
        ref={ref}
        value={inputValue}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled || isLoading}
        placeholder={isLoading ? " 카테고리 로딩 중..." : placeholder}
        className={className}
        autoComplete="off"
      />

      {/* 자동완성 드롭다운 */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredCategories.map((category, index) => (
            <button
              key={index}
              type="button"
              onClick={() => selectCategory(category)}
              className="w-full px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
            >
              <span className="mr-2">🏷️</span>
              {category}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

CategoryAutocomplete.displayName = 'CategoryAutocomplete';

export default CategoryAutocomplete;
