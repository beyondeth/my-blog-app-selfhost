"use client";

import React, { useState, useMemo } from 'react';
import { FiTag, FiFolder, FiChevronDown, FiChevronRight } from 'react-icons/fi';
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

// 트리 구조 데이터 타입
interface CategoryTreeNode {
  parent: string;
  totalCount: number;
  children: Array<{ fullPath: string; child: string; count: number }>;
  singleCategory?: { fullPath: string; count: number }; // child 없는 단일 카테고리
}

/**
 * 카테고리별 포스트 개수를 표시하는 사이드바 섹션
 *
 * @description
 * 블로그의 카테고리별 포스트 개수를 트리 구조로 표시합니다.
 * 슬래시(/)로 구분된 카테고리는 계층 구조로 그룹핑됩니다.
 * 사용 빈도순으로 정렬되어 표시됩니다.
 *
 * @param categories - 카테고리와 개수 배열
 * @param onCategoryClick - 카테고리 클릭 핸들러 (선택적)
 */
const CategorySection = React.memo(function CategorySection({
  categories,
  onCategoryClick
}: CategorySectionProps) {
  // 확장/축소 상태 관리 (parent 이름을 key로 사용)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());

  // 카테고리를 트리 구조로 변환
  const categoryTree = useMemo(() => {
    const tree = new Map<string, CategoryTreeNode>();

    categories.forEach((item) => {
      const { parent, child } = parseCategory(item.category);

      if (!tree.has(parent)) {
        tree.set(parent, {
          parent,
          totalCount: 0,
          children: [],
        });
      }

      const node = tree.get(parent)!;
      node.totalCount += item.count;

      if (child) {
        // 하위 카테고리가 있는 경우
        node.children.push({
          fullPath: item.category,
          child,
          count: item.count,
        });
      } else {
        // 단일 카테고리인 경우
        node.singleCategory = {
          fullPath: item.category,
          count: item.count,
        };
      }
    });

    return Array.from(tree.values());
  }, [categories]);

  const handleCategoryClick = (category: string) => {
    if (onCategoryClick) {
      onCategoryClick(category);
    }
  };

  const toggleParent = (parent: string) => {
    setExpandedParents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(parent)) {
        newSet.delete(parent);
      } else {
        newSet.add(parent);
      }
      return newSet;
    });
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
      <div className="space-y-1">
        {categoryTree.map((node, index) => {
          const hasChildren = node.children.length > 0;
          const isSingle = !hasChildren && node.singleCategory;
          const isExpanded = expandedParents.has(node.parent);

          return (
            <div key={index}>
              {/* Parent 카테고리 */}
              {isSingle ? (
                // 단일 카테고리 (child 없음)
                <button
                  onClick={() => handleCategoryClick(node.singleCategory!.fullPath)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[14px] rounded-lg transition-colors bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/30 text-left group"
                  aria-label={`${node.parent} 카테고리 (${node.singleCategory!.count}개)`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FiFolder className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                    <span className="text-gray-800 dark:text-gray-200 truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                      {node.parent}
                    </span>
                  </div>
                  <span className="flex-shrink-0 text-[13px] text-gray-500 dark:text-gray-400 font-medium ml-2">
                    {node.singleCategory!.count}
                  </span>
                </button>
              ) : (
                // 계층 카테고리 (children 있음)
                <>
                  <button
                    onClick={() => toggleParent(node.parent)}
                    className="w-full flex items-center justify-between px-3 py-2 text-[14px] rounded-lg transition-colors bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/30 text-left group"
                    aria-label={`${node.parent} 카테고리 펼치기/접기`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FiFolder className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                      <span className="text-gray-800 dark:text-gray-200 font-medium truncate group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                        {node.parent}
                      </span>
                      {isExpanded ? (
                        <FiChevronDown className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <FiChevronRight className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <span className="flex-shrink-0 text-[13px] text-gray-500 dark:text-gray-400 font-medium ml-2">
                      {node.totalCount}
                    </span>
                  </button>

                  {/* Children 카테고리 (확장 시) */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {node.children.map((childNode, childIndex) => (
                        <button
                          key={childIndex}
                          onClick={() => handleCategoryClick(childNode.fullPath)}
                          className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-black/20 text-left group"
                          aria-label={`${childNode.child} 카테고리 (${childNode.count}개)`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-gray-600 dark:text-gray-400 truncate group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">
                              - {childNode.child}
                            </span>
                          </div>
                          <span className="flex-shrink-0 text-[12px] text-gray-500 dark:text-gray-400 font-medium ml-2">
                            {childNode.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
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
