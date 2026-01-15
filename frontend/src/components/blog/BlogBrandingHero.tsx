"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Blog } from '@/types';
import { hexToRgbaString } from '@/lib/color';
import { cn } from '@/lib/utils';
import { FiEdit } from 'react-icons/fi';

interface BlogBrandingHeroProps {
  blog: Blog;
  brandColor?: string | null;
  isOwner: boolean;
}

const FALLBACK_GRADIENT = 'linear-gradient(135deg, rgba(15,23,42,0.85), rgba(3,7,18,0.9))';

/**
 * 블로그 페이지 상단 브랜딩 Hero 영역
 * - 커버 이미지 / 브랜드 색상 / 로고 / 아이콘을 조합해 보여줌
 */
export function BlogBrandingHero({
  blog,
  brandColor,
  isOwner,
}: BlogBrandingHeroProps) {
  const iconPlacement = blog.iconPlacement ?? 'inline';
  const isInlinePlacement = iconPlacement === 'inline';
  const isBadgePlacement = iconPlacement === 'badge';
  const iconTextEnabled = blog.iconTextEnabled ?? true;
  const iconLabelEnabled = blog.iconLabelEnabled ?? true;
  const iconSubtitleEnabled = blog.iconSubtitleEnabled ?? true;
  const rawLabel = blog.iconLabel?.trim();
  const rawSubtitle = blog.iconSubtitle?.trim();
  const fallbackTitle = blog.name || blog.slug;
  const fallbackSubtitle = blog.alias ? `@${blog.alias}` : `/${blog.slug}`;
  const resolvedLabel = rawLabel || 'Creator Blog';
  const resolvedTitle = fallbackTitle;
  const resolvedSubtitle = rawSubtitle || fallbackSubtitle;
  const showLabel = iconTextEnabled && iconLabelEnabled && Boolean(resolvedLabel);
  const showTitle = Boolean(resolvedTitle);
  const showSubtitle = iconTextEnabled && iconSubtitleEnabled && Boolean(resolvedSubtitle);
  const hasAnyText = showLabel || showTitle || showSubtitle;
  const showIconBox = Boolean(blog.iconUrl);
  const overlayColor = brandColor ? hexToRgbaString(brandColor, 0.22) : null;
  const coverFitClass =
    blog.coverImageFit === 'contain' ? 'object-contain bg-slate-950/70' : 'object-cover';
  const iconFitClass =
    blog.iconImageFit === 'cover' ? 'object-cover' : 'object-contain bg-white/70';
  const iconBadgeFitClass =
    blog.iconImageFit === 'cover' ? 'object-cover' : 'object-contain';
  const shouldRenderOverlay = Boolean(overlayColor);
  const overlayStyle = overlayColor
    ? blog.coverImageUrl
      ? {
          backgroundImage: `linear-gradient(120deg, ${overlayColor} 0%, rgba(0,0,0,0.25) 45%, rgba(0,0,0,0.6) 100%)`,
        }
      : { backgroundColor: overlayColor }
    : undefined;

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm',
        isBadgePlacement && 'pb-12'
      )}
    >
      <div className="absolute inset-0">
        {blog.coverImageUrl ? (
          <Image
            src={blog.coverImageUrl}
            alt={`${blog.name} cover`}
            fill
            priority={false}
            className={cn('object-center', coverFitClass)}
            sizes="(min-width: 1024px) 960px, 100vw"
            unoptimized
          />
        ) : (
          <div className="w-full h-full" style={{ backgroundImage: FALLBACK_GRADIENT }} />
        )}
        {shouldRenderOverlay && (
          <div className="absolute inset-0" style={overlayStyle} />
        )}
      </div>

      <div
        className={cn(
          'relative px-6 pt-8 text-white flex flex-col gap-6',
          isBadgePlacement ? 'pb-16 sm:pb-20' : 'pb-12 sm:pb-16'
        )}
      >
        <div className="flex flex-col gap-4">
          {isInlinePlacement && (
            <div className={cn('flex items-start gap-4', !showIconBox && 'gap-0')}>
              {showIconBox && (
                <div className="relative w-16 h-16 rounded-2xl bg-white/90 flex items-center justify-center overflow-hidden shadow-lg ring-1 ring-black/10">
                  <Image
                    src={blog.iconUrl as string}
                    alt={`${blog.name} icon`}
                    fill
                    sizes="64px"
                    className={cn('object-center', iconFitClass)}
                    unoptimized
                  />
                </div>
              )}

              {hasAnyText && (
                <div className={cn('flex flex-col gap-2', !showIconBox && 'ml-0')}>
                  {showLabel && (
                    <p className="text-xs uppercase tracking-[0.3em] text-white/80">{resolvedLabel}</p>
                  )}
                  {showTitle && (
                    <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{resolvedTitle}</h1>
                  )}
                  {showSubtitle && (
                    <p className="text-sm text-white/80 mt-1">{resolvedSubtitle}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {!isInlinePlacement && hasAnyText && (
            <div className="flex flex-col gap-2">
              {showLabel && (
                <p className="text-xs uppercase tracking-[0.3em] text-white/80">{resolvedLabel}</p>
              )}
              {showTitle && (
                <h1 className="text-3xl sm:text-4xl font-bold leading-tight">{resolvedTitle}</h1>
              )}
              {showSubtitle && (
                <p className="text-sm text-white/80 mt-1">{resolvedSubtitle}</p>
              )}
            </div>
          )}
        </div>

        {blog.description && (
          <p className="text-base sm:text-lg text-white/90 leading-relaxed max-w-3xl whitespace-pre-line">
            {blog.description}
          </p>
        )}

        {isOwner && (
          <Link
            href="/settings/blog"
            className="absolute right-4 top-4 inline-flex items-center justify-center rounded-full h-8 w-8 bg-white text-gray-900 border border-gray-200 shadow-sm hover:bg-gray-100"
            aria-label="브랜딩 수정"
          >
            <FiEdit className="w-4 h-4" />
          </Link>
        )}
      </div>

      {isBadgePlacement && showIconBox && (
        <div className="absolute left-8 -bottom-10 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-gray-900 bg-white/95 dark:bg-gray-900/70 shadow-2xl flex items-center justify-center overflow-hidden">
          {blog.iconUrl ? (
            <Image
              src={blog.iconUrl}
              alt={`${blog.name} icon`}
              fill
              sizes="96px"
              className={cn('object-center', iconBadgeFitClass)}
              unoptimized
            />
          ) : (
            <span className="text-2xl font-bold text-gray-900 dark:text-white">
              {blog.name?.charAt(0)?.toUpperCase() ?? 'B'}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
