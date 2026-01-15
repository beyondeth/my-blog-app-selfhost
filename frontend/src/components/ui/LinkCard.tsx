'use client';

import React from 'react';
import Image from 'next/image';
import { FiExternalLink, FiLink } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import { useOpenGraph, OpenGraphData } from '@/hooks/opengraph';

/**
 * LinkCard 컴포넌트 Props
 */
interface LinkCardProps {
  /** 표시할 URL */
  url: string;
  /** 추가 CSS 클래스 */
  className?: string;
  /** 컴팩트 모드 (작은 카드) */
  compact?: boolean;
  /** 새 탭에서 열기 */
  openInNewTab?: boolean;
}

/**
 * HTML 엔티티 디코딩 함수 (Client Side)
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  const entities: Record<string, string> = {
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#039;': "'",
    '&#39;': "'"
  };
  
  // 1차 디코딩
  let decoded = text.replace(/&(?:quot|apos|amp|lt|gt|#039|#39);/g, match => entities[match]);
  
  // 혹시 모를 이중 인코딩 (예: &amp;quot;) 처리를 위해 한 번 더 체크
  if (decoded.includes('&')) {
    decoded = decoded.replace(/&(?:quot|apos|amp|lt|gt|#039|#39);/g, match => entities[match]);
  }
  
  return decoded;
}


/**
 * 링크 카드 컴포넌트
 *
 * @description
 * URL의 Open Graph 메타데이터를 표시하는 링크 카드입니다.
 * Reddit/Twitter 스타일의 링크 미리보기를 제공합니다.
 *
 * **특징:**
 * - Open Graph 메타데이터 자동 로드
 * - 이미지, 제목, 설명, 도메인 표시
 * - 로딩/에러 상태 처리
 * - 반응형 디자인
 * - 컴팩트 모드 지원
 *
 * @example
 * ```tsx
 * <LinkCard url="https://github.com/user/repo" />
 * <LinkCard url="https://example.com" compact />
 * ```
 */
export default function LinkCard({
  url,
  className,
  compact = false,
  openInNewTab = true,
}: LinkCardProps) {
  const { data, isLoading, error } = useOpenGraph(url);

  // 로딩 상태
  if (isLoading) {
    return <LinkCardSkeleton compact={compact} className={className} />;
  }

  // 에러 또는 실패 상태 → 폴백 카드
  if (error || !data?.success) {
    return (
      <LinkCardFallback
        url={url}
        compact={compact}
        openInNewTab={openInNewTab}
        className={className}
      />
    );
  }

  // 성공 상태
  return (
    <LinkCardContent
      data={data}
      compact={compact}
      openInNewTab={openInNewTab}
      className={className}
    />
  );
}

/**
 * 링크 카드 컨텐츠 (성공 상태)
 */
interface LinkCardContentProps {
  data: OpenGraphData;
  compact: boolean;
  openInNewTab: boolean;
  className?: string;
}

function LinkCardContent({
  data,
  compact,
  openInNewTab,
  className,
}: LinkCardContentProps) {
  const hasImage = Boolean(data.imageUrl);
  const linkProps = openInNewTab
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <a
      href={data.url}
      {...linkProps}
      className={cn(
        'link-card group flex items-center justify-between gap-4 rounded-2xl border bg-white transition-all',
        'border-gray-200 hover:border-gray-300 hover:shadow-sm',
        'dark:bg-gray-900 dark:border-gray-700 dark:hover:border-gray-600',
        'px-6 py-5 max-w-full',
        className
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {data.faviconUrl && (
            <Image
              src={data.faviconUrl}
              alt=""
              width={14}
              height={14}
              className="rounded-sm opacity-90"
              unoptimized
            />
          )}
          <span className="truncate">
            {data.siteName || data.domain || data.url.replace(/^https?:\/\//, '')}
          </span>
        </div>

        {data.title && (
          <h3
            className={cn(
              'text-gray-900 dark:text-gray-100 line-clamp-1 font-semibold leading-tight',
              'text-[0.95rem] sm:text-[1rem]'
            )}
          >
            {decodeHtmlEntities(data.title)}
          </h3>
        )}

        {data.description && (
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
            {decodeHtmlEntities(data.description)}
          </p>
        )}

        <div className="text-xs text-gray-400 truncate">
          {data.url.replace(/^https?:\/\//, '')}
        </div>
      </div>

      <div
        className={cn(
          'link-card-thumb relative overflow-hidden rounded-lg bg-gray-50 flex-shrink-0 border border-gray-100 dark:border-gray-800',
          compact ? 'w-14 h-14' : 'w-20 h-20'
        )}
      >
        {hasImage ? (
          <Image
            src={data.imageUrl!}
            alt={data.title || 'Link preview'}
            fill
            className="object-cover transition-transform duration-300"
            sizes={compact ? '56px' : '80px'}
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-300">
            <FiLink className="w-5 h-5" />
          </div>
        )}
      </div>
    </a>
  );
}

/**
 * 링크 카드 폴백 (에러 상태)
 */
interface LinkCardFallbackProps {
  url: string;
  compact: boolean;
  openInNewTab: boolean;
  className?: string;
}

function LinkCardFallback({
  url,
  compact,
  openInNewTab,
  className,
}: LinkCardFallbackProps) {
  const linkProps = openInNewTab
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  // 도메인 추출
  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {
    domain = url;
  }

  return (
    <a
      href={url}
      {...linkProps}
      className={cn(
        'link-card group flex items-center justify-between gap-4 rounded-[28px] border bg-white transition-all',
        'border-gray-100 hover:border-blue-200',
        'dark:bg-gray-900 dark:border-gray-800',
        'px-5 py-4',
        className
      )}
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400">
          {domain}
        </p>
        <p className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
          {url}
        </p>
      </div>
      <div className="link-card-thumb w-24 h-24 rounded-[18px] bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400">
        <FiLink className="w-6 h-6" />
      </div>
    </a>
  );
}

/**
 * 링크 카드 스켈레톤 (로딩 상태)
 */
interface LinkCardSkeletonProps {
  compact: boolean;
  className?: string;
}

function LinkCardSkeleton({ compact, className }: LinkCardSkeletonProps) {
  return (
    <div
      className={cn(
        'link-card border rounded-[28px] animate-pulse',
        'border-gray-100 bg-white',
        'flex items-center justify-between gap-4 px-5 py-4',
        className
      )}
    >
      <div className="flex-1 space-y-3">
        <div className="h-3 bg-gray-200 rounded w-1/4" />
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="link-card-thumb w-20 h-20 bg-gray-200 rounded-2xl" />
    </div>
  );
}

/**
 * LinkCard 미리보기 (편집기용)
 *
 * @description
 * URL 입력 시 실시간 미리보기를 표시합니다.
 */
interface LinkCardPreviewProps {
  url: string;
  onRemove?: () => void;
  className?: string;
}

export function LinkCardPreview({
  url,
  onRemove,
  className,
}: LinkCardPreviewProps) {
  return (
    <div className={cn('relative', className)}>
      <LinkCard url={url} openInNewTab={false} />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 bg-gray-900/60 text-white rounded-full hover:bg-gray-900/80 transition-colors"
          title="링크 제거"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
