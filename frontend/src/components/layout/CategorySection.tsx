"use client";

import React from 'react';
import { FiTag, FiFolder, FiFile } from 'react-icons/fi';
import SidebarSection from './SidebarSection';

interface CategorySectionProps {
  categories: Array<{ category: string; count: number }>;
  onCategoryClick?: (category: string) => void;
}

// 카테고리 파싱 헬퍼: "JavaScript/React" → { parent: "JavaScript", child: "React" }
const parseCategory = (category: string): { parent: string; child?: string } => {
  const parts = category.split('/').map(p => p.trim()).filter(Boolean);
  return {
    parent: parts[0],
    child: parts[1] || undefined,
  };
};

/**
 * 카테고리별 포스트 개수를 표시하는 사이드바 섹션
 *
 * @description
 * 블로그의 카테고리별 포스트 개수를 리스트 형태로 표시합니다.
 * 슬래시(/)로 구분된 카테고리는 계층 구조로 표시됩니다.
 * 사용 빈도순으로 정렬되어 표시됩니다.
 *
 * @param categories - 카테고리와 개수 배열
 * @param onCategoryClick - 카테고리 클릭 핸들러 (선택적)
 */
const CategorySection = React.memo(function CategorySection({
  categories,
  onCategoryClick
}: CategorySectionProps) {
  const handleCategoryClick = (category: string) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    }
  };

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <FiTag className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span>카테고리</span>
        </div>
      }
    >
      <div className="space-y-2">
        {categories.map((item, index) => {
          const { parent, child } = parseCategory(item.category);
          const isHierarchical = !!child;

          return (
            <button
              key={index}
              onClick={() => handleCategoryClick(item.category)}
              className="w-full flex items-center justify-between px-3 py-2 text-[14px] rounded-lg transition-colors bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/30 text-left group"
              aria-label={`${item.category} 카테고리 (${item.count}개)`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {/* 계층 아이콘 */}
                {isHierarchical ? (
                  <>
                    <FiFolder className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-gray-800 dark:text-gray-200 font-medium group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                        {parent}
                      </span>
                      <span className="text-gray-400 dark:text-gray-500">/</span>
                      <span className="text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">
                        {child}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <FiTag className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                      {parent}
                    </span>
                  </>
                )}
              </div>
              <span className="flex-shrink-0 text-[13px] text-gray-500 dark:text-gray-400 font-medium ml-2">
                {item.count}
              </span>
            </button>
          );
        })}
        {categories.length === 0 && (
          <div className="text-center py-4 text-gray-500 w-full">
            <p className="text-[15px]">카테고리가 없습니다.</p>
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default CategorySection;
