'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Avatar } from '@/components/ui/avatar';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';
import VoteButton from '@/components/ui/VoteButton';
import BlurredImage from '@/components/ui/BlurredImage';
import { FiHeart, FiMessageCircle, FiEye, FiAlertTriangle, FiLock } from 'react-icons/fi';
import type { VoteType } from '@/types';
import { formatRelativeTime } from '@/utils/timeFormat';
import { extractImageKey, normalizeImageUrl, shouldDisableOptimization } from '@/utils/imageUtils';
import { determineFeedLayout, FeedLayoutType, extractYouTubeVideoId } from '@/utils/feedLayoutUtils';
import { useAdultVerificationStatus } from '@/hooks/adult-verification/useAdultVerification';
import { UnifiedFeedItem as FeedItemType } from '@/services/api/feed.service';
import PostImageCarousel from '@/components/posts/PostImageCarousel';
import PostImageLightbox from '@/components/posts/PostImageLightbox';
import YouTubeEmbedPlayer from '@/components/ui/YouTubeEmbedPlayer';

/**
 * UnifiedFeedItem 컴포넌트 Props
 */
interface UnifiedFeedItemProps {
  item: FeedItemType;
  /** 투표 핸들러 (upvote/downvote) */
  onVote?: (item: FeedItemType, voteType: 'upvote' | 'downvote') => void;
  votePending?: boolean;
  priority?: boolean;
}

/**
 * HTML 태그 제거 및 순수 텍스트 반환
 */
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  const withoutTags = html.replace(/<[^>]*>/g, '');
  return withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * 썸네일 크기 상수 (CSS-only 반응형)
 *
 * @description
 * JavaScript resize 이벤트 대신 CSS 미디어 쿼리로 반응형 처리.
 * 성능 최적화 및 SSR 호환성 향상.
 *
 * **기본 모드 (소형 썸네일):**
 * - xs (< 375px): 120x113
 * - sm (375-420px): 140x132
 * - md (>= 421px): 210x197
 *
 * **이미지 중심 모드 (대형 이미지):**
 * - 전체 너비 이미지 (aspect-video)
 * - 이미지가 콘텐츠의 주요 요소로 표시
 */
const THUMBNAIL_SIZES = {
  xs: { width: 120, height: 113 },
  sm: { width: 140, height: 132 },
  md: { width: 210, height: 197 },
} as const;

/**
 * 피드 아이템의 레이아웃 타입 결정 (공통 유틸리티 래퍼)
 *
 * @description
 * Reddit 스타일 피드 레이아웃 결정:
 * - 썸네일 없음 → 텍스트 중심 (제목 + excerpt)
 * - 썸네일 있음 → 이미지 중심 (제목 + 큰 이미지, excerpt 숨김)
 *
 * @param item 피드 아이템
 * @returns 레이아웃 타입
 */
const getFeedLayoutType = (item: FeedItemType): FeedLayoutType => {
  return determineFeedLayout({
    thumbnail: item.thumbnail,
    excerpt: item.excerpt,
    youtubeVideoId: item.youtubeVideoId,
  });
};

/**
 * 통합 피드 아이템 컴포넌트
 *
 * @description 블로그 포스트와 커뮤니티 포스트를 통합하여 표시
 *
 * **특징:**
 * - 소스 타입에 따라 다른 라우팅 (블로그: /{blogSlug}/{postSlug}, 커뮤니티: /c/{communitySlug}/comments/{postId})
 * - NSFW/스포일러 경고 표시
 * - CSS-only 반응형 썸네일 (JS resize 이벤트 제거로 성능 최적화)
 */
const UnifiedFeedItem = React.memo(function UnifiedFeedItem({
  item,
  onVote,
  votePending = false,
  priority = false,
}: UnifiedFeedItemProps) {
  // NSFW 성인 인증 상태 확인
  const { isAdultVerified } = useAdultVerificationStatus();

  // NSFW 콘텐츠 블러 처리 여부 (NSFW 게시물이고 미인증 상태)
  const shouldBlurNsfw = item.isNsfw && !isAdultVerified;
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);

  // 투표 핸들러 (새 API 우선, 구버전 호환)
  const handleVote = React.useCallback((voteType: 'upvote' | 'downvote') => {
    if (onVote) {
      onVote(item, voteType);
    }
  }, [item, onVote]);

  const isPending = votePending;
  // excerpt 처리
  const displayContent = item.excerpt ? stripHtmlTags(item.excerpt) : '';

  // 레이아웃 타입 결정 (공통 유틸리티 사용)
  const layoutType = React.useMemo(() => getFeedLayoutType(item), [item]);
  const useImageFocused = layoutType === 'image-focused';
  const useVideoFocused = layoutType === 'video-focused';
  const relativeTime = React.useMemo(() => formatRelativeTime(item.createdAt), [item.createdAt]);

  // 포스트 상세 페이지 URL 생성
  const getPostUrl = (): string => {
    if (item.sourceType === 'blog' && item.blog) {
      // 블로그 포스트: /{blogSlug}/{postSlug}
      const blogSlug = item.blog.alias || item.blog.slug;
      return `/${blogSlug}/${item.slug}`;
    } else if (item.sourceType === 'community' && item.community) {
      // 커뮤니티 포스트: /c/{communitySlug}/comments/{postId} (Reddit 스타일)
      return `/c/${item.community.slug}/comments/${item.slug}`;
    }
    return '#';
  };
  const postUrl = getPostUrl();
  const imageSources = React.useMemo(() => {
    const orderedImages = Array.isArray(item.images)
      ? item.images.filter((url): url is string => Boolean(url && url.trim()))
      : [];
    const prefixed = item.thumbnail
      ? [item.thumbnail, ...orderedImages]
      : orderedImages;
    const normalized = prefixed
      .map((url) => normalizeImageUrl(url))
      .filter((url): url is string => Boolean(url && url.trim()));
    const unique: string[] = [];
    const seen = new Set<string>();
    normalized.forEach((url) => {
      const key = extractImageKey(url) ?? url;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(url);
      }
    });
    return unique;
  }, [item.images, item.thumbnail]);
  const hasImages = imageSources.length > 0;
  const handleOpenLightbox = React.useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);
  const handleCloseLightbox = React.useCallback(() => setLightboxOpen(false), []);

  // NSFW 경고 표시
  const showNsfwWarning = item.isNsfw;
  // 스포일러 경고 표시
  const showSpoilerWarning = item.isSpoiler;
  const blurReason: 'nsfw' | 'spoiler' = showSpoilerWarning ? 'spoiler' : 'nsfw';

  const primaryImage = hasImages ? imageSources[0] : undefined;
  const youtubeVideoId = React.useMemo(() => {
    if (item.youtubeVideoId) return item.youtubeVideoId;
    if (item.thumbnail) return extractYouTubeVideoId(item.thumbnail);
    return null;
  }, [item.thumbnail, item.youtubeVideoId]);

  return (
    <>
      <article className="border-b border-gray-200 dark:border-gray-800 py-6 sm:py-4 first:pt-0">
        {/* 이미지 중심 레이아웃: 상단에 대형 이미지 표시 (Reddit 스타일) */}
        {useImageFocused && hasImages && (
          <div className="mb-4">
            <PostImageCarousel
              images={imageSources}
              onImageClick={handleOpenLightbox}
              isHomeFeed
              shouldBlur={shouldBlurNsfw}
              blurReason={blurReason}
              priority={priority}
            />
          </div>
        )}

      {/* 기본 레이아웃:
          - 이미지 중심 모드: 이미 위에 표시됨 → flex-col만 사용
          - 기본 모드: 모바일은 flex-col, 데스크톱은 flex-row */}
        <div className={`flex ${
          useImageFocused || useVideoFocused
            ? 'flex-col'
            : hasImages
              ? 'flex-col min-[421px]:flex-row min-[421px]:gap-12'
              : 'flex-col'
        }`}>
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* 출처/작성자 정보 */}
          <div className="mb-3">
            {item.sourceType === 'community' && item.community ? (
              <div className="flex items-start gap-3">
                <Link href={`/c/${item.community.slug}`} className="flex-shrink-0">
                  <Avatar
                    src={item.community.iconUrl}
                    alt={item.community.name}
                    fallback={item.community.name}
                    size="sm"
                    priority={priority}
                    imageFit={item.community.iconImageFit ?? 'cover'}
                  />
                </Link>
                <div className="flex flex-col leading-tight">
                  <Link
                    href={`/c/${item.community.slug}`}
                    className="text-[15px] font-semibold text-gray-800 dark:text-gray-200 hover:text-primary transition-colors"
                  >
                    c/{item.community.name || item.community.slug}
                  </Link>
                  <div className="flex flex-wrap items-center gap-1 text-[13px] text-gray-500 dark:text-gray-400">
                    <UserLinkWithTooltip
                      userId={item.author.id}
                      username={item.author.username}
                    >
                      <span className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                        {item.author.username}
                      </span>
                    </UserLinkWithTooltip>
                    <span className="text-gray-400 dark:text-gray-500" aria-hidden="true">
                      ·
                    </span>
                    <time className="text-gray-500 dark:text-gray-400" dateTime={item.createdAt}>
                      {relativeTime}
                    </time>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <UserLinkWithTooltip
                  userId={item.author.id}
                  username={item.author.username}
                  blogSlug={item.blog?.alias || item.blog?.slug}
                >
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={item.author.profileImage}
                      alt={item.author.username}
                      fallback={item.author.username}
                      size="sm"
                      priority={priority}
                    />
                    <span className="text-[15px] text-gray-700 dark:text-gray-300 font-medium">
                      b/{item.author.username}
                    </span>
                  </div>
                </UserLinkWithTooltip>
                <span className="text-gray-400 dark:text-gray-500" aria-hidden="true">
                  ·
                </span>
                <time className="text-[13px] text-gray-500 dark:text-gray-400" dateTime={item.createdAt}>
                  {relativeTime}
                </time>
              </div>
            )}
          </div>

          {/* 제목 - 이미지 중심일 때 더 큰 폰트 */}
          <h2 className={`font-bold text-foreground leading-tight line-clamp-2 break-words ${
            useImageFocused
              ? 'text-xl sm:text-2xl mb-4'
              : 'text-lg sm:text-xl mb-2 sm:mb-3'
          }`}>
            <Link
              href={postUrl}
              className="hover:text-primary transition-colors block"
            >
              {/* NSFW/스포일러 배지 */}
              {showNsfwWarning && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mr-2 text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                  <FiLock className="w-3 h-3" />
                  NSFW
                </span>
              )}
              {showSpoilerWarning && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mr-2 text-[11px] font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded">
                  <FiAlertTriangle className="w-3 h-3" />
                  Spoiler
                </span>
              )}
              {item.title}
            </Link>
          </h2>

          {useVideoFocused && youtubeVideoId && (
            <div className="w-full mb-7 max-w-full">
              <div className="w-full max-w-[780px] mx-auto">
                <YouTubeEmbedPlayer
                  videoId={youtubeVideoId}
                  title={item.title}
                  aspectRatio={0.788}
                  className="relative w-full"
                  iframeClassName="absolute inset-0 w-full h-full rounded-lg shadow-sm"
                />
              </div>
            </div>
          )}

          {/* 내용 미리보기 - 텍스트 중심 레이아웃에서만 표시 */}
          {!useImageFocused && !useVideoFocused && displayContent && (
            <p className="text-[15px] text-foreground leading-relaxed line-clamp-3 break-words mb-7">
              {displayContent}
            </p>
          )}
          {!useImageFocused && !useVideoFocused && !displayContent && (
            <p className="text-[15px] text-gray-400 italic leading-relaxed line-clamp-3 break-words mb-7">
              내용 미리보기가 없습니다.
            </p>
          )}

          {/* 하단 메타 정보 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex flex-wrap items-center text-[13px] text-gray-500 dark:text-gray-400 gap-3 sm:gap-5">
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-5 h-5" />
                <span>{item.viewCount || 0}</span>
              </span>
              {/* 투표 버튼 (Upvote/Downvote) */}
              <VoteButton
                upvoteCount={item.upvoteCount ?? item.likeCount ?? 0}
                downvoteCount={item.downvoteCount ?? 0}
                userVote={item.userVote ?? (item.liked ? 'upvote' : null)}
                onVote={handleVote}
                disabled={isPending || !onVote}
                compact
                displayMode="separated"
              />
              <Link
                href={`${postUrl}#comments`}
                className="flex items-center gap-1 whitespace-nowrap cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{item.commentCount || 0}</span>
              </Link>

              {/* 고정 포스트 표시 */}
              {item.isPinned && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                  고정됨
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Thumbnail - CSS-only 반응형 (기본 모드에서만 표시)
            브레이크포인트:
            - xs (<375px): 120x113, 중앙 정렬
            - sm (375-420px): 140x132, 중앙 정렬
            - md (>=421px): 210x197, 오른쪽 배치

            이미지 중심 레이아웃에서는 상단에 대형 이미지로 표시되므로 여기서는 숨김 */}
        {primaryImage && !useImageFocused && (
          <div className="flex-shrink-0 mt-4 min-[421px]:mt-0 min-[421px]:self-center min-[421px]:ml-6">
            {/* xs 사이즈 (<375px) */}
            <div
              className="block max-[374px]:mx-auto min-[375px]:hidden"
              style={{ width: THUMBNAIL_SIZES.xs.width, height: THUMBNAIL_SIZES.xs.height }}
            >
              {shouldBlurNsfw ? (
                <BlurredImage
                  src={primaryImage}
                  alt={item.title}
                  isBlurred={true}
                  blurReason={blurReason}
                  width={THUMBNAIL_SIZES.xs.width}
                  height={THUMBNAIL_SIZES.xs.height}
                  className="w-full h-full object-contain rounded"
                  sizes={`${THUMBNAIL_SIZES.xs.width}px`}
                  priority={priority}
                />
              ) : (
                <Image
                  src={primaryImage}
                  alt={item.title}
                  width={THUMBNAIL_SIZES.xs.width}
                  height={THUMBNAIL_SIZES.xs.height}
                  className="w-full h-full object-contain rounded"
                  sizes={`${THUMBNAIL_SIZES.xs.width}px`}
                  priority={priority}
                  unoptimized={shouldDisableOptimization(primaryImage)}
                />
              )}
            </div>

            {/* sm 사이즈 (375-420px) */}
            <div
              className="hidden min-[375px]:block min-[375px]:mx-auto min-[421px]:hidden"
              style={{ width: THUMBNAIL_SIZES.sm.width, height: THUMBNAIL_SIZES.sm.height }}
            >
              {shouldBlurNsfw ? (
                <BlurredImage
                  src={primaryImage}
                  alt={item.title}
                  isBlurred={true}
                  blurReason={blurReason}
                  width={THUMBNAIL_SIZES.sm.width}
                  height={THUMBNAIL_SIZES.sm.height}
                  className="w-full h-full object-contain rounded"
                  sizes={`${THUMBNAIL_SIZES.sm.width}px`}
                  priority={priority}
                />
              ) : (
                <Image
                  src={primaryImage}
                  alt={item.title}
                  width={THUMBNAIL_SIZES.sm.width}
                  height={THUMBNAIL_SIZES.sm.height}
                  className="w-full h-full object-contain rounded"
                  sizes={`${THUMBNAIL_SIZES.sm.width}px`}
                  priority={priority}
                  unoptimized={shouldDisableOptimization(primaryImage)}
                />
              )}
            </div>

            {/* md 사이즈 (>=421px, 데스크톱) */}
            <div
              className="hidden min-[421px]:block"
              style={{ width: THUMBNAIL_SIZES.md.width, height: THUMBNAIL_SIZES.md.height }}
            >
              {shouldBlurNsfw ? (
                <BlurredImage
                  src={primaryImage}
                  alt={item.title}
                  isBlurred={true}
                  blurReason={blurReason}
                  width={THUMBNAIL_SIZES.md.width}
                  height={THUMBNAIL_SIZES.md.height}
                  className="w-full h-full object-contain rounded"
                  sizes={`${THUMBNAIL_SIZES.md.width}px`}
                  priority={priority}
                />
              ) : (
                <Image
                  src={primaryImage}
                  alt={item.title}
                  width={THUMBNAIL_SIZES.md.width}
                  height={THUMBNAIL_SIZES.md.height}
                  className="w-full h-full object-contain rounded"
                  sizes={`${THUMBNAIL_SIZES.md.width}px`}
                  priority={priority}
                  unoptimized={shouldDisableOptimization(primaryImage)}
                />
              )}
            </div>
          </div>
        )}
        </div>
      </article>
      {hasImages && (
        <PostImageLightbox
          images={imageSources}
          open={lightboxOpen}
          startIndex={lightboxIndex}
          onClose={handleCloseLightbox}
          postUrl={postUrl}
        />
      )}
    </>
  );
});

export default UnifiedFeedItem;
