"use client";

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/providers/AuthProviderV2';
import { Post, VoteType } from '@/types';
import type { CommunityFlair, CommunityRoleType } from '@/types/community';
import { Avatar } from '@/components/ui/avatar';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';
import QualityScoreBadge from '@/components/ui/QualityScoreBadge';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import ModerationModal from '../admin/ModerationModal';
import VoteButton from '@/components/ui/VoteButton';
import FlairBadge from '@/components/community/FlairBadge';
import MemberRoleBadge from '@/components/community/MemberRoleBadge';
import PostSourceMeta from '@/components/posts/PostSourceMeta';
import {
  FiMessageCircle,
  FiEye,
  FiTarget,
  FiTag,
  FiAlertCircle,
  FiPlay,
  FiBookmark,
  FiLock,
  FiAlertTriangle,
} from 'react-icons/fi';
import { createHighlightedHTML, highlightAndTruncate } from '@/utils/highlight';
import { formatRelativeTime } from '@/utils/timeFormat';
import { extractImageKey, normalizeImageUrl, shouldDisableOptimization } from '@/utils/imageUtils';
import { determineFeedLayout, extractYouTubeVideoId, FeedLayoutType, hasVideoEmbed, extractFirstVideoId } from '@/utils/feedLayoutUtils';
import VideoRenderer from '@/components/ui/content-renderer/components/VideoRenderer';
import PostImageCarousel from '@/components/posts/PostImageCarousel';
import PostImageLightbox from '@/components/posts/PostImageLightbox';
import BlurredImage from '@/components/ui/BlurredImage';
import type { FeedCommunityContext } from '@/utils/feed/unifiedFeedAdapter';

interface CommunityContextMeta extends FeedCommunityContext {
  shouldBlurMedia?: boolean;
}

interface PostArticleProps {
  post: Post;
  isAdmin: boolean;
  isAuthenticated: boolean;
  userId?: string;
  onEdit: (slug: string) => void;
  onDelete: (id: string) => void;
  onPin?: (postId: string, postSlug: string, isPinned: boolean) => void;

  /** @deprecated onVote 사용 권장 */
  onLike?: (postId: string) => void;
  /** 투표 핸들러 (upvote/downvote) */
  onVote?: (postId: string, voteType: 'upvote' | 'downvote') => void;
  isDeleting?: boolean;
  /** @deprecated votePending 사용 권장 */
  likePending?: boolean;
  votePending?: boolean;
  searchQuery?: string;
  priority?: boolean;
  isHomeFeed?: boolean;
  showAuthorPrefix?: boolean;
  showCommunityHeader?: boolean;
  postUrlOverride?: string;
  communityContext?: CommunityContextMeta;
}

// HTML 태그를 제거하고 순수 텍스트만 반환하는 로컬 함수
const stripHtmlTags = (html: string): string => {
  if (!html) return '';
  
  // HTML 태그 제거
  const withoutTags = html.replace(/<[^>]*>/g, '');
  
  // HTML 엔티티 디코딩
  const withoutEntities = withoutTags
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // 연속된 공백을 하나로 변환하고 앞뒤 공백 제거
  return withoutEntities.replace(/\s+/g, ' ').trim();
};

const PostArticle = React.memo(function PostArticle({
  post,
  isAdmin,
  isAuthenticated,
  userId,
  onEdit,
  onDelete,
  onPin,
  onLike,
  onVote,
  isDeleting = false,
  likePending = false,
  votePending = false,
  searchQuery,
  priority = false,
  isHomeFeed = false,
  showAuthorPrefix = true,
  showCommunityHeader = true,
  postUrlOverride,
  communityContext,
}: PostArticleProps) {
  // 투표 핸들러 (새 API 우선, 구버전 호환)
  const handleVote = React.useCallback((voteType: 'upvote' | 'downvote') => {
    if (onVote) {
      onVote(post.id, voteType);
    } else if (onLike && voteType === 'upvote') {
      // 레거시: upvote만 onLike로 처리
      onLike(post.id);
    }
  }, [post.id, onVote, onLike]);

  const isPending = votePending || likePending;
  const homeTextPrimary = 'text-[#1B2430] dark:text-[#E6EDF3]';
  const homeTextSecondary = 'text-[#425466] dark:text-[#C7D2E0]';
  const homeTextMuted = 'text-[#7B8794] dark:text-[#A9B4C2]';
  const homeTextSubtle = 'text-[#9AA4B2] dark:text-[#728093]';
  const metaRowClass = isHomeFeed ? homeTextSecondary : 'text-gray-600 dark:text-gray-200';
  const metaMutedClass = isHomeFeed ? homeTextMuted : 'text-gray-500 dark:text-gray-400';
  const metaMutedStrongClass = isHomeFeed ? homeTextMuted : 'text-gray-500 dark:text-gray-600';
  const metaFaintClass = isHomeFeed ? homeTextSubtle : 'text-gray-400 dark:text-gray-500';
  const editButtonClass = isHomeFeed
    ? `text-xs ${homeTextSecondary} hover:text-[#9B6B2E] dark:hover:text-[#F6D36A] whitespace-nowrap`
    : 'text-xs text-gray-700 dark:text-gray-200 hover:text-amber-700 dark:hover:text-amber-400 whitespace-nowrap';
  const deleteButtonClass = isHomeFeed
    ? `text-xs ${homeTextSecondary} hover:text-[#B13B35] dark:hover:text-[#F49A8A] disabled:opacity-50 whitespace-nowrap`
    : 'text-xs text-gray-700 dark:text-gray-200 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-50 whitespace-nowrap';
  const editorPickClass = isHomeFeed
    ? `flex items-center gap-1 ${homeTextSecondary} whitespace-nowrap`
    : 'flex items-center gap-1 text-gray-700 dark:text-gray-300 whitespace-nowrap';
  const titleTextClass = isHomeFeed ? homeTextPrimary : 'text-foreground';
  const bodyTextClass = isHomeFeed ? 'text-[#3F4A59] dark:text-[#E1E8F0]' : 'text-foreground';
  const voteTone = isHomeFeed ? 'harbor' : 'default';
  const articleBaseClass = isHomeFeed
    ? 'border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-[#0E141B] py-5 sm:rounded-3xl sm:border sm:border-[#D9E0EA] sm:hover:bg-[#F7F9FC] sm:transition-colors sm:dark:border-[#4B5563] sm:dark:bg-[#131A22] sm:dark:hover:bg-[#1A232E] sm:p-6 sm:shadow-sm'
    : 'border-b border-gray-200 dark:border-gray-800 py-4 sm:py-6 first:pt-0';
  const articleClassName = isHomeFeed ? `${articleBaseClass} w-full sm:max-w-[780px] sm:mx-auto` : articleBaseClass;
  const defaultPostUrl = post.blog?.slug ? `/${post.blog.slug}/${post.slug || post.id}` : '#';
  const postUrl = postUrlOverride ?? defaultPostUrl;
  const showCommunityContext = Boolean(communityContext);
  const shouldBlurMedia = communityContext?.shouldBlurMedia ?? false;
  const blurReason: 'nsfw' | 'spoiler' = communityContext?.isSpoiler ? 'spoiler' : 'nsfw';
  const displayCategory = !showCommunityContext ? post.category : '';
  const communityFlair = communityContext?.flair;
  const hasCommunityBadges =
    !!communityContext &&
    (communityContext.isPinned ||
      communityContext.isLocked ||
      communityContext.isNsfw ||
      communityContext.isSpoiler);
  const communityBadgeSection = hasCommunityBadges ? (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      {communityContext?.isPinned && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          <FiBookmark className="w-3 h-3" />
          고정됨
        </span>
      )}
      {communityContext?.isLocked && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          <FiLock className="w-3 h-3" />
          댓글 잠금
        </span>
      )}
      {communityContext?.isNsfw && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
          NSFW
        </span>
      )}
      {communityContext?.isSpoiler && (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
          <FiAlertTriangle className="w-3 h-3" />
          스포일러
        </span>
      )}
    </div>
  ) : null;
  const shouldShowCommunityHeader = Boolean(communityContext) && showCommunityHeader;
  const sourceMetaVariant = isHomeFeed
      ? 'home'
      : 'default';
  const headerCommunityContext = shouldShowCommunityHeader ? communityContext : undefined;
  const shouldShowAuthorPrefix = showAuthorPrefix && !(communityContext && !showCommunityHeader);
  const timestamp = post.publishedAt || post.createdAt;
  const relativeTime = React.useMemo(
    () => (timestamp ? formatRelativeTime(timestamp) : ''),
    [timestamp],
  );
  const showFooterTimestamp = !isHomeFeed && Boolean(relativeTime && timestamp);
  const renderSourceMeta = (infoClassName: string, categoryClassName: string) => (
    <PostSourceMeta
      post={post}
      communityContext={headerCommunityContext}
      infoClassName={infoClassName}
      categoryClassName={categoryClassName}
      displayCategory={!showCommunityContext ? displayCategory : undefined}
      priority={priority}
      variant={sourceMetaVariant}
      showAuthorPrefix={shouldShowAuthorPrefix}
      timestamp={timestamp}
      relativeTime={relativeTime}
    />
  );
  const renderFlairBadge = (className?: string) =>
    communityFlair ? <FlairBadge flair={communityFlair} size="xs" className={className} /> : null;

  // 레이아웃 타입 결정 (공통 유틸리티 사용)
  const layoutType = React.useMemo((): FeedLayoutType => {
    return determineFeedLayout({
      thumbnail: post.thumbnail,
      excerpt: post.excerpt,
      content: post.content,
    });
  }, [post.thumbnail, post.excerpt, post.content]);
  const isImageFocused = layoutType === 'image-focused';

  // YouTube 비디오 ID (비디오 중심 레이아웃일 때만 추출)
  const youtubeVideoId = React.useMemo(() => {
    if (layoutType !== 'video-focused' || !post.thumbnail) return null;
    return extractYouTubeVideoId(post.thumbnail);
  }, [layoutType, post.thumbnail]);

  // 업로드된 비디오 포함 여부
  const hasVideo = React.useMemo(() => {
    return hasVideoEmbed(post.content);
  }, [post.content]);

  // 비디오 ID 추출 (인라인 재생용 - VideoRenderer에서 API 호출)
  const videoId = React.useMemo(() => {
    if (!hasVideo) return null;
    return extractFirstVideoId(post.content);
  }, [hasVideo, post.content]);

  // 비디오 재생 상태 (클릭 시 인라인 재생)
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(false);
  const [isModerationModalOpen, setIsModerationModalOpen] = React.useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const isVideoPost = hasVideo && !!videoId;
  const imageSources = React.useMemo(() => {
    const orderedImages = Array.isArray(post.images)
      ? post.images.filter((url): url is string => Boolean(url && url.trim()))
      : [];
    const prioritized = post.thumbnail
      ? [post.thumbnail, ...orderedImages]
      : orderedImages;
    const normalized = prioritized
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
  }, [post.images, post.thumbnail]);
  const hasImages = imageSources.length > 0;
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const [lightboxIndex, setLightboxIndex] = React.useState(0);
  const handleOpenLightbox = React.useCallback((index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }, []);
  const mediaWrapperClass = isHomeFeed
    ? 'relative w-full max-w-[780px] mx-auto overflow-hidden rounded-xl bg-[#EEF3F8] dark:bg-[#1A232E]'
    : 'relative w-full overflow-hidden rounded-xl bg-[#EEF3F8] dark:bg-[#1A232E]';
  const renderThumbnailImage = React.useCallback(() => {
    const source = imageSources[0] || post.thumbnail;
    if (!source) {
      return null;
    }
    const disableOptimization = shouldDisableOptimization(source);

    if (isHomeFeed) {
      return (
        <div className="relative aspect-[700/540]">
          {shouldBlurMedia ? (
            <BlurredImage
              src={source}
              alt={post.title}
              isBlurred
              blurReason={blurReason}
              fill
              sizes="(max-width: 1024px) 90vw, 700px"
              className="object-contain bg-black/5"
              priority={priority}
              unoptimized={disableOptimization}
            />
          ) : (
            <Image
              src={source}
              alt={post.title}
              fill
              sizes="(max-width: 1024px) 90vw, 700px"
              className="object-contain bg-black/5"
              priority={priority}
              unoptimized={disableOptimization}
            />
          )}
        </div>
      );
    }

    if (shouldBlurMedia) {
      return (
        <BlurredImage
          src={source}
          alt={post.title}
          isBlurred
          blurReason={blurReason}
          width={0}
          height={0}
          sizes="100vw"
          style={{ width: '100%', height: 'auto', display: 'block' }}
          className="object-cover max-h-[540px]"
          priority={priority}
          unoptimized={disableOptimization}
        />
      );
    }

    return (
      <Image
        src={source}
        alt={post.title}
        width={0}
        height={0}
        sizes="100vw"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        className="object-cover max-h-[540px]"
        priority={priority}
        unoptimized={disableOptimization}
      />
    );
  }, [imageSources, isHomeFeed, post.thumbnail, post.title, priority, shouldBlurMedia, blurReason]);

  // 삭제된 포스트 상태 확인
  const isDeleted = post.isDeleted || post.status === 'deleted';

  // 삭제된 포스트는 간단한 상태 UI만 표시
  if (isDeleted) {
    return (
      <>
        <article className={articleClassName}>
          <div className="bg-[#EEF3F8] dark:bg-[#1A232E] rounded-lg border-l-4 border-red-400 p-4">
            <div className={`flex items-center gap-3 ${metaMutedClass} mb-2`}>
              <FiAlertCircle className="w-5 h-5 text-red-400" />
              <span className="font-medium">삭제된 게시물</span>
            </div>
            <p className={`text-sm ${metaFaintClass}`}>
              이 포스트는 작성자에 의해 삭제되었습니다
            </p>
            {post.title && (
              <div className="mt-3">
                <p className={`text-xs ${metaMutedStrongClass} line-clamp-1`}>
                  제목: {post.title}
                </p>
              </div>
            )}
          </div>
        </article>
        {hasImages && (
          <PostImageLightbox
            images={imageSources}
            open={lightboxOpen}
            startIndex={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            postUrl={postUrl}
          />
        )}
      </>
    );
  }

  // excerpt가 있으면 사용, 없으면 content에서 추출

  // excerpt를 우선 사용 (홈/목록 페이지용)
  let displayContent = '';

  if (post.excerpt) {
    // excerpt가 있으면 그대로 사용
    displayContent = post.excerpt;
  } else if (post.content) {
    // excerpt가 없고 content만 있으면 content에서 추출 (fallback)
    const cleanContent = stripHtmlTags(post.content);
    const maxLength = 150;
    displayContent = cleanContent && cleanContent.length > maxLength
      ? cleanContent.substring(0, maxLength) + '...'
      : cleanContent || '';
  }
  
  
  // YouTube 비디오인 경우 Reddit 스타일 레이아웃
  if (youtubeVideoId) {
    return (
      <>
      <article className={articleClassName}>
        <div className={`flex flex-col ${isHomeFeed ? 'px-4 sm:px-0' : ''}`}>
          {renderSourceMeta('mb-4', 'mb-2')}
          {communityBadgeSection}
          <h2 className={`text-lg sm:text-xl font-bold ${titleTextClass} leading-tight mb-1`}>
            <Link
              href={postUrl}
              className="hover:text-primary transition-colors"
            >
              {searchQuery ? (
                <span dangerouslySetInnerHTML={createHighlightedHTML(post.title, searchQuery)} />
              ) : (
                post.title
              )}
            </Link>
          </h2>
          {renderFlairBadge('mb-4')}

          {/* YouTube 비디오 플레이어 - 반응형 */}
          <div className="w-full mb-7 max-w-full">
            <div className="w-full max-w-[780px] mx-auto">
              <div className="relative w-full" style={{ paddingBottom: '78.8%' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`}
                  title={post.title}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full rounded-lg shadow-sm"
                />
              </div>
            </div>
          </div>
          
          {/* 하단 고정 영역 - 메타 정보와 버튼을 한 줄에 배치 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* 메타 정보 (날짜,조회,좋아요,댓글) */}
            <div className={`flex flex-wrap items-center text-[13px] ${metaRowClass} gap-3 sm:gap-5`}>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-5 h-5" />
                <span>{post.viewCount || 0}</span>
              </span>
              {/* 투표 버튼 (Upvote/Downvote) */}
              <VoteButton
                upvoteCount={post.upvoteCount ?? post.likeCount ?? 0}
                downvoteCount={post.downvoteCount ?? 0}
                userVote={post.userVote ?? (post.liked ? 'upvote' : null)}
                onVote={handleVote}
                disabled={isPending || (!onVote && !onLike)}
                compact
                displayMode="separated"
                tone={voteTone}
              />
              <Link
                href={`${postUrl}#comments`}
                className="flex items-center gap-1 whitespace-nowrap cursor-pointer hover:text-[#1B2430] dark:hover:text-[#E6EDF3] transition-colors"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{post.commentCount || 0}</span>
              </Link>

                  {/* 수정/삭제 버튼 */}
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.id)}
                    className={editButtonClass}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    disabled={isDeleting}
                    className={deleteButtonClass}
                  >
                    {isDeleting ? '삭제중...' : '삭제'}
                  </button>
                </>
              )}
              {/* 관리자/모더레이터 전용 버튼 */}
              {onPin && (
                  <button
                    onClick={() => onPin(post.id, post.slug || post.id, !communityContext?.isPinned)}
                    className={`text-xs whitespace-nowrap flex items-center gap-1 ${
                      communityContext?.isPinned 
                        ? 'text-green-600 hover:text-green-700 dark:text-green-500 dark:hover:text-green-400' 
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    <FiBookmark className={`w-3 h-3 ${communityContext?.isPinned ? 'fill-current' : ''}`} />
                    {communityContext?.isPinned ? '고정 해제' : '상단 고정'}
                  </button>
              )}
              {isAdmin && (
                    <button
                      onClick={() => setIsModerationModalOpen(true)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 whitespace-nowrap flex items-center gap-1"
                    >
                      <FiAlertTriangle className="w-3 h-3" />
                      제재
                    </button>
                  )}
              {post.isEditorPick && (
                <span className={editorPickClass}>
                  <FiTarget className="w-5 h-5" />
                  <span className="text-[11px]">Pick</span>
                </span>
              )}
              {isAdmin && post.qualityScore != null && (
                <QualityScoreBadge
                  score={post.qualityScore}
                  aiType={post.tags?.find(tag => tag.startsWith('ai:'))?.replace('ai:', '') || 'unknown'}
                  className="inline-block"
                />
              )}
            </div>
          </div>
        </div>
      </article>
      {hasImages && (
        <PostImageLightbox
          images={imageSources}
          open={lightboxOpen}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          postUrl={postUrl}
        />
      )}
      </>
    );
  }

  if (layoutType === 'image-focused' && post.thumbnail) {
    return (
      <>
      <article className={articleClassName}>
        <div className="flex flex-col">
          {renderSourceMeta('mb-3', 'mb-2')}
          {communityBadgeSection}

          {/* 제목 - 이미지 중심 레이아웃은 큰 제목 */}
          <h2 className={`text-lg sm:text-xl font-bold ${titleTextClass} leading-tight mb-2`}>
            <Link
              href={postUrl}
              className="hover:text-primary transition-colors"
            >
              {searchQuery ? (
                <span dangerouslySetInnerHTML={createHighlightedHTML(post.title, searchQuery)} />
              ) : (
                post.title
              )}
            </Link>
          </h2>
          {renderFlairBadge('mb-4')}

          {/* 대형 이미지 혹은 인라인 비디오 */}
          {isVideoPost && isVideoPlaying ? (
            <div className={`mb-4 relative w-full overflow-hidden rounded-xl ${isHomeFeed ? 'max-w-[780px] mx-auto' : ''}`}>
              <VideoRenderer
                videoId={videoId!}
                fullWidth
                autoPlay
              />
            </div>
          ) : isVideoPost ? (
            <button
              onClick={() => setIsVideoPlaying(true)}
              className={`block mb-4 w-full focus:outline-none ${isHomeFeed ? 'flex justify-center' : ''}`}
            >
              <div className={mediaWrapperClass}>
                {renderThumbnailImage()}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-4">
                    <FiPlay className="w-10 h-10 text-white fill-white" />
                  </div>
                </div>
              </div>
            </button>
          ) : (
            hasImages && (
              <div className="mb-4">
                <PostImageCarousel
                  images={imageSources}
                  onImageClick={handleOpenLightbox}
                  isHomeFeed={isHomeFeed}
                  shouldBlur={shouldBlurMedia}
                  blurReason={blurReason}
                />
              </div>
            )
          )}

          {/* 메타 정보 (투표, 댓글 등) */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className={`flex flex-wrap items-center text-[13px] ${metaRowClass} gap-3 sm:gap-5`}>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-5 h-5" />
                <span>{post.viewCount || 0}</span>
              </span>
              <VoteButton
                upvoteCount={post.upvoteCount ?? post.likeCount ?? 0}
                downvoteCount={post.downvoteCount ?? 0}
                userVote={post.userVote ?? (post.liked ? 'upvote' : null)}
                onVote={handleVote}
                disabled={isPending || (!onVote && !onLike)}
                compact
                displayMode="separated"
                tone={voteTone}
              />
              <Link
                href={`${postUrl}#comments`}
                className="flex items-center gap-1 whitespace-nowrap cursor-pointer hover:text-[#1B2430] dark:hover:text-[#E6EDF3] transition-colors"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{post.commentCount || 0}</span>
              </Link>
              {/* 수정/삭제 버튼 (관리자/작성자) */}
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.id)}
                    className={editButtonClass}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    disabled={isDeleting}
                    className={deleteButtonClass}
                  >
                    {isDeleting ? '삭제중...' : '삭제'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setIsModerationModalOpen(true)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 whitespace-nowrap flex items-center gap-1"
                    >
                      <FiAlertTriangle className="w-3 h-3" />
                      제재
                    </button>
                  )}
                </>
              )}
              {post.isEditorPick && (
                <span className={editorPickClass}>
                  <FiTarget className="w-5 h-5" />
                  <span className="text-[11px]">Pick</span>
                </span>
              )}
              {isAdmin && post.qualityScore != null && (
                <QualityScoreBadge
                  score={post.qualityScore}
                  aiType={post.tags?.find(tag => tag.startsWith('ai:'))?.replace('ai:', '') || 'unknown'}
                  className="inline-block"
                />
              )}
            </div>
          </div>
        </div>
      </article>
      {hasImages && (
        <PostImageLightbox
          images={imageSources}
          open={lightboxOpen}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          postUrl={postUrl}
        />
      )}
      {isAdmin && (
        <ModerationModal
          isOpen={isModerationModalOpen}
          onClose={() => setIsModerationModalOpen(false)}
          targetType="post"
          targetId={post.id}
        />
      )}
      </>
    );
  }


  if (layoutType === 'image-focused' && post.thumbnail) {
    return (
      <>
      <article className={articleClassName}>
        <div className={`flex flex-col ${isHomeFeed ? 'px-4 sm:px-0' : ''}`}>
          {renderSourceMeta('mb-3', 'mb-2')}
          {communityBadgeSection}

          {/* 제목 - 이미지 중심 레이아웃은 큰 제목 */}
          <h2 className={`text-lg sm:text-xl font-bold ${titleTextClass} leading-tight mb-2`}>
            <Link
              href={postUrl}
              className="hover:text-primary transition-colors"
            >
              {searchQuery ? (
                <span dangerouslySetInnerHTML={createHighlightedHTML(post.title, searchQuery)} />
              ) : (
                post.title
              )}
            </Link>
          </h2>
          {renderFlairBadge('mb-4')}

          {/* 대형 이미지 혹은 인라인 비디오 */}
          {isVideoPost && isVideoPlaying ? (
            <div className={`mb-4 relative w-full overflow-hidden rounded-xl ${isHomeFeed ? 'max-w-[780px] mx-auto' : ''}`}>
              <VideoRenderer
                videoId={videoId!}
                fullWidth
                autoPlay
              />
            </div>
          ) : isVideoPost ? (
            <button
              onClick={() => setIsVideoPlaying(true)}
              className={`block mb-4 w-full focus:outline-none ${isHomeFeed ? 'flex justify-center' : ''}`}
            >
              <div className={mediaWrapperClass}>
                {renderThumbnailImage()}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="bg-black/50 rounded-full p-4">
                    <FiPlay className="w-10 h-10 text-white fill-white" />
                  </div>
                </div>
              </div>
            </button>
          ) : (
            hasImages && (
              <div className="mb-4">
                <PostImageCarousel
                  images={imageSources}
                  onImageClick={handleOpenLightbox}
                  isHomeFeed={isHomeFeed}
                  shouldBlur={shouldBlurMedia}
                  blurReason={blurReason}
                />
              </div>
            )
          )}

          {/* 메타 정보 (투표, 댓글 등) */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className={`flex flex-wrap items-center text-[13px] ${metaRowClass} gap-3 sm:gap-5`}>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-5 h-5" />
                <span>{post.viewCount || 0}</span>
              </span>
              <VoteButton
                upvoteCount={post.upvoteCount ?? post.likeCount ?? 0}
                downvoteCount={post.downvoteCount ?? 0}
                userVote={post.userVote ?? (post.liked ? 'upvote' : null)}
                onVote={handleVote}
                disabled={isPending || (!onVote && !onLike)}
                compact
                displayMode="separated"
                tone={voteTone}
              />
              <Link
                href={`${postUrl}#comments`}
                className="flex items-center gap-1 whitespace-nowrap cursor-pointer hover:text-[#1B2430] dark:hover:text-[#E6EDF3] transition-colors"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{post.commentCount || 0}</span>
              </Link>
              {/* 수정/삭제 버튼 (관리자/작성자) */}
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.id)}
                    className={editButtonClass}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    disabled={isDeleting}
                    className={deleteButtonClass}
                  >
                    {isDeleting ? '삭제중...' : '삭제'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setIsModerationModalOpen(true)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 whitespace-nowrap flex items-center gap-1"
                    >
                      <FiAlertTriangle className="w-3 h-3" />
                      제재
                    </button>
                  )}
                </>
              )}
              {post.isEditorPick && (
                <span className={editorPickClass}>
                  <FiTarget className="w-5 h-5" />
                  <span className="text-[11px]">Pick</span>
                </span>
              )}
              {isAdmin && post.qualityScore != null && (
                <QualityScoreBadge
                  score={post.qualityScore}
                  aiType={post.tags?.find(tag => tag.startsWith('ai:'))?.replace('ai:', '') || 'unknown'}
                  className="inline-block"
                />
              )}
            </div>
          </div>
        </div>
      </article>
      {hasImages && (
        <PostImageLightbox
          images={imageSources}
          open={lightboxOpen}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          postUrl={postUrl}
        />
      )}

      <ModerationModal 
        isOpen={isModerationModalOpen}
        onClose={() => setIsModerationModalOpen(false)}
        targetType="post"
        targetId={post.id}
      />
      </>
    );
  }

  // 텍스트 중심 레이아웃 (기존 로직) - 썸네일이 없는 경우
  return (
    <>
    <article className={articleClassName}>
      <div className="flex flex-col">
        {/* Content */}
        <div className={`flex-1 min-w-0 flex flex-col ${isHomeFeed ? 'px-4 sm:px-0' : ''}`}>
          {renderSourceMeta('mb-4', 'mb-3')}
          {communityBadgeSection}

          <h2 className={`text-lg sm:text-xl font-bold ${titleTextClass} mb-2 sm:mb-3 leading-tight line-clamp-2 break-words`}>
            <Link
              href={postUrl}
              className="hover:text-primary transition-colors block"
            >
              {searchQuery ? (
                <span dangerouslySetInnerHTML={createHighlightedHTML(post.title, searchQuery)} />
              ) : (
                post.title
              )}
            </Link>
          </h2>

          {/* 비디오 포함 시 인라인 재생 (썸네일 없는 경우) - 이미지와 동일한 크기 */}
          {hasVideo && !post.thumbnail && videoId && (
            <>
              {renderFlairBadge('mb-4')}
              <div className="mb-4">
                {isVideoPlaying ? (
                  // 비디오 플레이어 (VideoRenderer - API에서 URL 동적 조회)
                  <div className="relative w-full overflow-hidden rounded-xl">
                    <VideoRenderer
                      videoId={videoId}
                      fullWidth
                      autoPlay
                    />
                  </div>
                ) : (
                  // 플레이 버튼 (클릭 시 재생) - 이미지 레이아웃과 동일한 스타일
                  <button
                    onClick={() => setIsVideoPlaying(true)}
                    className="relative w-full aspect-video bg-[#EEF3F8] dark:bg-[#1A232E] rounded-xl overflow-hidden flex items-center justify-center cursor-pointer hover:bg-[#DCE3EC] dark:hover:bg-[#223040] transition-colors"
                  >
                    <div className="bg-black/50 rounded-full p-4">
                      <FiPlay className="w-10 h-10 text-white fill-white" />
                    </div>
                    <span className={`absolute bottom-3 left-4 text-sm ${metaMutedClass}`}>
                      비디오 포함
                    </span>
                  </button>
                )}
              </div>
            </>
          )}

          {displayContent && (
            <p
              className={`text-[15px] ${bodyTextClass} leading-relaxed line-clamp-3 break-words mb-7`}
              dangerouslySetInnerHTML={{ __html: displayContent }}
            />
          )}
          {!displayContent && !hasVideo && (
            <p className={`text-[15px] ${metaFaintClass} italic leading-relaxed line-clamp-3 break-words mb-7`}>
              내용 미리보기가 없습니다.
            </p>
          )}
          {!isImageFocused && !hasVideo && renderFlairBadge('mb-4')}

          {hasImages && (
            <div className="mb-4">
              <PostImageCarousel
                images={imageSources}
                onImageClick={handleOpenLightbox}
                isHomeFeed={isHomeFeed}
                shouldBlur={shouldBlurMedia}
                blurReason={blurReason}
              />
            </div>
          )}

          {/* 하단 고정 영역 - 메타 정보와 버튼을 한 줄에 배치 */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* 메타 정보 (날짜,조회,좋아요,댓글) */}
            <div className={`flex flex-wrap items-center text-[13px] ${metaRowClass} gap-3 sm:gap-5`}>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-5 h-5" />
                <span>{post.viewCount || 0}</span>
              </span>
              {/* 투표 버튼 (Upvote/Downvote) */}
              <VoteButton
                upvoteCount={post.upvoteCount ?? post.likeCount ?? 0}
                downvoteCount={post.downvoteCount ?? 0}
                userVote={post.userVote ?? (post.liked ? 'upvote' : null)}
                onVote={handleVote}
                disabled={isPending || (!onVote && !onLike)}
                compact
                displayMode="separated"
                tone={voteTone}
              />
              <Link
                href={`${postUrl}#comments`}
                className="flex items-center gap-1 whitespace-nowrap cursor-pointer hover:text-[#1B2430] dark:hover:text-[#E6EDF3] transition-colors"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{post.commentCount || 0}</span>
              </Link>

              {/* 수정/삭제 버튼 */}
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.id)}
                    className={editButtonClass}
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    disabled={isDeleting}
                    className={deleteButtonClass}
                  >
                    {isDeleting ? '삭제중...' : '삭제'}
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setIsModerationModalOpen(true)}
                      className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 whitespace-nowrap flex items-center gap-1"
                    >
                      <FiAlertTriangle className="w-3 h-3" />
                      제재
                    </button>
                  )}
                </>
              )}

              {post.isEditorPick && (
                <span className={editorPickClass}>
                  <FiTarget className="w-5 h-5" />
                  <span className="text-[11px]">Pick</span>
                </span>
              )}
              {isAdmin && post.qualityScore != null && (
                <QualityScoreBadge
                  score={post.qualityScore}
                  aiType={post.tags?.find(tag => tag.startsWith('ai:'))?.replace('ai:', '') || 'unknown'}
                  className="inline-block"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </article>
    {hasImages && (
      <PostImageLightbox
        images={imageSources}
        open={lightboxOpen}
        startIndex={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
        postUrl={postUrl}
      />
    )}
    
    <ModerationModal 
      isOpen={isModerationModalOpen}
      onClose={() => setIsModerationModalOpen(false)}
      targetType="post"
      targetId={post.id}
    />
    </>
  );
});

export default PostArticle; 
