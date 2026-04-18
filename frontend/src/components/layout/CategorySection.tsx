"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { FiTag, FiFolder, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import SidebarSection from './SidebarSection';
import SidebarNodeIcon from './SidebarNodeIcon';

interface CategorySectionProps {
  categories: Array<{ category: string; count: number }>;
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  className?: string;
}

// 카테고리 파싱 헬퍼: "JavaScript/React" → { parent: "JavaScript", child: "React" }
const parseCategory = (category: string): { parent: string; child?: string } => {
  const parts = category.split('/').map(p => p.trim()).filter(Boolean);
  return {
    parent: parts[0],
    child: parts[1] || undefined,
  };
};

const isParentCategorySelected = (parent: string, selectedCategory?: string | null) => {
  if (!selectedCategory) {
    return false;
  }

  return (
    selectedCategory === parent ||
    selectedCategory.startsWith(`${parent}/`)
  );
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
  onCategoryClick,
  selectedCategory,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
  className,
}: CategorySectionProps) {
  // 확장/축소 상태 관리 (parent 이름을 key로 사용)
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [collapseBaseCount, setCollapseBaseCount] = useState(0);
  const [isCollapsedView, setIsCollapsedView] = useState(false);

  // 최초 로드된 카테고리 개수를 기준으로 접기/펼치기 제어
  useEffect(() => {
    setCollapseBaseCount((prev) => {
      if (categories.length === 0) {
        if (prev !== 0) {
          setIsCollapsedView(false);
        }
        return 0;
      }
      if (prev === 0 || categories.length < prev) {
        setIsCollapsedView(false);
        return categories.length;
      }
      return prev;
    });
  }, [categories.length]);

  useEffect(() => {
    if (!selectedCategory) {
      return;
    }

    const { parent, child } = parseCategory(selectedCategory);
    if (!child) {
      return;
    }

    setExpandedParents((prev) => {
      if (prev.has(parent)) {
        return prev;
      }

      const next = new Set(prev);
      next.add(parent);
      return next;
    });
  }, [selectedCategory]);

  const visibleCategories = useMemo(() => {
    if (
      isCollapsedView &&
      collapseBaseCount > 0 &&
      categories.length > collapseBaseCount
    ) {
      return categories.slice(0, collapseBaseCount);
    }
    return categories;
  }, [categories, collapseBaseCount, isCollapsedView]);

  // 카테고리를 트리 구조로 변환
  const categoryTree = useMemo(() => {
    const tree = new Map<string, CategoryTreeNode>();

    visibleCategories.forEach((item) => {
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
  }, [visibleCategories]);

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

  const handleLoadMoreClick = () => {
    if (onLoadMore) {
      onLoadMore();
    }
    setIsCollapsedView(false);
  };

  const canCollapse = collapseBaseCount > 0 && categories.length > collapseBaseCount;

  return (
    <SidebarSection
      className={className}
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
          const isSingleActive =
            Boolean(node.singleCategory) &&
            selectedCategory === node.singleCategory?.fullPath;
          const isParentActive = hasChildren && isParentCategorySelected(node.parent, selectedCategory);

          return (
            <div key={index}>
              {/* Parent 카테고리 */}
              {isSingle ? (
                // 단일 카테고리 (child 없음)
                <button
                  onClick={() => handleCategoryClick(node.singleCategory!.fullPath)}
                  data-category-path={node.singleCategory!.fullPath}
                  data-category-node-type="single"
                  className={cn(
                    "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] transition-colors",
                    isSingleActive
                      ? "bg-[#EEF4FB] hover:bg-[#E6F0FB] dark:bg-[#141E28] dark:hover:bg-[#182433]"
                      : "bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/30",
                  )}
                  aria-label={`${node.parent} 카테고리 (${node.singleCategory!.count}개)`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <SidebarNodeIcon
                      icon={FiFolder}
                      isActive={isSingleActive}
                      iconClassName="text-gray-600 dark:text-gray-400"
                    />
                    <span
                      className={cn(
                        "truncate transition-colors",
                        isSingleActive
                          ? "font-semibold text-[#1B2430] dark:text-[#E6EDF3]"
                          : "text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-100",
                      )}
                    >
                      {node.parent}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "ml-2 flex-shrink-0 text-[13px] font-medium",
                      isSingleActive
                        ? "text-[#264653] dark:text-[#9FE2D7]"
                        : "text-gray-500 dark:text-gray-400",
                    )}
                  >
                    {node.singleCategory!.count}
                  </span>
                </button>
              ) : (
                // 계층 카테고리 (children 있음)
                <>
                  <button
                    onClick={() => toggleParent(node.parent)}
                    data-category-parent={node.parent}
                    data-category-node-type="parent"
                    className={cn(
                      "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[14px] transition-colors",
                      isParentActive
                        ? "bg-[#EEF4FB] hover:bg-[#E6F0FB] dark:bg-[#141E28] dark:hover:bg-[#182433]"
                        : "bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/30",
                    )}
                    aria-label={`${node.parent} 카테고리 펼치기/접기`}
                  >
                    <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                      <SidebarNodeIcon
                        icon={FiFolder}
                        isActive={isParentActive}
                        iconClassName="text-gray-600 dark:text-gray-400"
                      />
                      <span
                        className={cn(
                          "truncate transition-colors",
                          isParentActive
                            ? "font-semibold text-[#1B2430] dark:text-[#E6EDF3]"
                            : "font-medium text-gray-800 group-hover:text-gray-900 dark:text-gray-200 dark:group-hover:text-gray-100",
                        )}
                      >
                        {node.parent}
                      </span>
                      {isExpanded ? (
                        <FiChevronDown className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <FiChevronRight className="flex-shrink-0 w-4 h-4 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "ml-2 flex-shrink-0 text-[13px] font-medium",
                        isParentActive
                          ? "text-[#264653] dark:text-[#9FE2D7]"
                          : "text-gray-500 dark:text-gray-400",
                      )}
                    >
                      {node.totalCount}
                    </span>
                  </button>

                  {/* Children 카테고리 (확장 시) */}
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {node.children.map((childNode, childIndex) => {
                        const isChildActive =
                          selectedCategory === childNode.fullPath;

                        return (
                        <button
                          key={childIndex}
                          onClick={() => handleCategoryClick(childNode.fullPath)}
                          data-category-path={childNode.fullPath}
                          data-category-node-type="child"
                          className={cn(
                            "group flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[13px] transition-colors",
                            isChildActive
                              ? "bg-[#EEF4FB] hover:bg-[#E6F0FB] dark:bg-[#141E28] dark:hover:bg-[#182433]"
                              : "hover:bg-gray-100 dark:hover:bg-black/20",
                          )}
                          aria-label={`${childNode.child} 카테고리 (${childNode.count}개)`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={cn(
                                "truncate transition-colors",
                                isChildActive
                                  ? "font-semibold text-[#1B2430] dark:text-[#E6EDF3]"
                                  : "text-gray-600 group-hover:text-gray-800 dark:text-gray-400 dark:group-hover:text-gray-300",
                              )}
                            >
                              - {childNode.child}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "ml-2 flex-shrink-0 text-[12px] font-medium",
                              isChildActive
                                ? "text-[#264653] dark:text-[#9FE2D7]"
                                : "text-gray-500 dark:text-gray-400",
                            )}
                          >
                            {childNode.count}
                          </span>
                        </button>
                        );
                      })}
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

        {hasMore && onLoadMore && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLoadMoreClick}
              disabled={isLoadingMore}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-black/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoadingMore ? '불러오는 중...' : '카테고리 더보기'}
            </button>
          </div>
        )}

        {canCollapse && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setIsCollapsedView((prev) => !prev)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-black/20 transition-colors"
            >
              {isCollapsedView ? '카테고리 펼치기' : '카테고리 접기'}
            </button>
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default CategorySection;
