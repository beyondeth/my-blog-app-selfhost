'use client';

import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import type { MarketplaceProduct } from '@/types/marketplace';

/** 금액 포맷팅 */
function formatPrice(price: number): string {
  return new Intl.NumberFormat('ko-KR').format(price);
}

interface ProductCardProps {
  product: MarketplaceProduct;
}

/**
 * 마켓플레이스 상품 카드
 * 카드형 그리드 레이아웃용 — 썸네일, 제목, 가격, 판매자, 판매 수
 */
export default function ProductCard({ product }: ProductCardProps) {
  const pd = product.productDetail;

  return (
    <Link
      href={`/marketplace/${product.slug}`}
      className="group block rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden transition-all hover:border-gray-300 dark:hover:border-zinc-700 hover:shadow-md"
    >
      {/* 썸네일 */}
      <div className="aspect-[16/10] bg-gray-100 dark:bg-zinc-800 relative overflow-hidden">
        {product.thumbnailImageId ? (
          <img
            src={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'}/api/v1/files/${product.thumbnailImageId}`}
            alt={product.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
          </div>
        )}

        {/* 카테고리 배지 */}
        {pd?.categoryLabel && (
          <span className="absolute top-2 left-2 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/90 dark:bg-zinc-900/90 text-gray-700 dark:text-zinc-300 backdrop-blur-sm">
            {pd.categoryLabel}
          </span>
        )}
      </div>

      {/* 콘텐츠 */}
      <div className="p-4">
        {/* 제목 */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug group-hover:text-gray-700 dark:group-hover:text-zinc-200 transition-colors">
          {product.title}
        </h3>

        {/* 설명 */}
        {product.excerpt && (
          <p className="mt-1.5 text-xs text-gray-500 dark:text-zinc-400 line-clamp-2">
            {product.excerpt}
          </p>
        )}

        {/* 판매자 */}
        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            {product.author?.username || '판매자'}
          </span>
          {pd && pd.salesCount > 0 && (
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              {pd.salesCount}건 판매
            </span>
          )}
        </div>

        {/* 가격 */}
        {pd && (
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
            <span className="text-base font-bold text-gray-900 dark:text-white">
              ₩{formatPrice(pd.price)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
