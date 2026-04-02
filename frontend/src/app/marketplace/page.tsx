'use client';

import { useState, useCallback } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useMarketplaceProducts, useMarketplaceCategories } from '@/hooks/useMarketplace';
import ProductCard from '@/components/marketplace/ProductCard';
import type { ProductCategory, BrowseParams } from '@/types/marketplace';
import { ProductCategoryLabel } from '@/types/marketplace';

/** 정렬 옵션 */
const SORT_OPTIONS = [
  { value: 'recent', label: '최신순' },
  { value: 'popular', label: '인기순' },
  { value: 'price_low', label: '낮은 가격순' },
  { value: 'price_high', label: '높은 가격순' },
] as const;

export default function MarketplacePage() {
  const [category, setCategory] = useState<ProductCategory | undefined>();
  const [sort, setSort] = useState<BrowseParams['sort']>('recent');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const { data: categories } = useMarketplaceCategories();
  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMarketplaceProducts({ category, sort, search, limit: 20 });

  // 모든 페이지의 상품을 평탄화
  const products = data?.pages.flatMap((page) => page.products) ?? [];

  // 검색 핸들러 (Enter 또는 버튼 클릭)
  const handleSearch = useCallback(() => {
    setSearch(searchInput.trim());
  }, [searchInput]);

  return (
    <div className="min-h-screen bg-white dark:bg-[#0E141B]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">

        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            마켓플레이스
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
            AI 프롬프트, 코딩 템플릿, 기술 가이드를 거래하세요
          </p>
        </div>

        {/* 검색 + 정렬 */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          {/* 검색바 */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="상품 검색..."
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 dark:focus:ring-zinc-600"
            />
          </div>

          {/* 정렬 */}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as BrowseParams['sort'])}
            className="h-10 px-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory(undefined)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !category
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
          >
            전체
          </button>
          {(categories || []).map((cat) => (
            <button
              key={cat.category}
              onClick={() =>
                setCategory(
                  category === cat.category ? undefined : cat.category,
                )
              }
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                category === cat.category
                  ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                  : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {cat.label}
              <span className="ml-1 text-xs opacity-60">{cat.count}</span>
            </button>
          ))}
        </div>

        {/* 상품 그리드 */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="aspect-[16/10] bg-gray-100 dark:bg-zinc-800 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse" />
                  <div className="h-5 w-1/3 bg-gray-200 dark:bg-zinc-700 rounded animate-pulse mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <SlidersHorizontal className="h-12 w-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-zinc-400">
              {search || category
                ? '검색 결과가 없습니다'
                : '아직 등록된 상품이 없습니다'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* 더 보기 */}
            {hasNextPage && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-6 py-2.5 rounded-lg border border-gray-200 dark:border-zinc-700 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                >
                  {isFetchingNextPage ? '로딩 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
