"use client";

import React from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import OptimizedImage from '@/components/ui/OptimizedImage';
import UserAvatar from '@/components/ui/UserAvatar';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';
import QualityScoreBadge from '@/components/ui/QualityScoreBadge';
import { FiHeart, FiMessageCircle, FiEye } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import { createHighlightedHTML, highlightAndTruncate } from '@/utils/highlight';
import { formatRelativeTime } from '@/utils/timeFormat';

interface PostArticleProps {
  post: Post;
  isAdmin: boolean;
  isAuthenticated: boolean;
  userId?: string;
  onEdit: (slug: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
  searchQuery?: string; // 검색어 하이라이팅을 위한 prop
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
  isDeleting = false,
  searchQuery,
}: PostArticleProps) {
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
  
  // YouTube 썸네일인지 확인하고 비디오 ID 추출 (개선된 감지 로직)
  let isYouTubeThumbnail = false;
  let youtubeVideoId = null;
  
  // thumbnail URL에서 YouTube 패턴 확인
  if (post.thumbnail) {
    
    // YouTube 썸네일 URL 패턴들 (우선순위 순서)
    const youtubePatterns = [
      // 1. 표준 YouTube 썸네일 URL 패턴
      /(?:https?:\/\/)?img\.youtube\.com\/vi\/([a-zA-Z0-9_-]{11})\/(?:maxresdefault|hqdefault|mqdefault|sddefault|default)\.jpg/,
      /(?:https?:\/\/)?i\.ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})\/(?:maxresdefault|hqdefault|mqdefault|sddefault|default)\.jpg/,
      
      // 2. 짧은 형식
      /(?:https?:\/\/)?(?:img\.)?youtube\.com\/vi\/([a-zA-Z0-9_-]{11})/,
      /(?:https?:\/\/)?(?:www\.)?ytimg\.com\/vi\/([a-zA-Z0-9_-]{11})/,
      
      // 3. webp 형식 포함
      /(?:https?:\/\/)?i\d*\.ytimg\.com\/vi(?:_webp)?\/([a-zA-Z0-9_-]{11})/,
      
      // 4. 다양한 품질 지정자
      /\/vi\/([a-zA-Z0-9_-]{11})\/(?:maxresdefault|hqdefault|mqdefault|sddefault|default|0|1|2|3)/
    ];
    
    // 각 패턴으로 테스트
    for (const pattern of youtubePatterns) {
      const match = post.thumbnail.match(pattern);
      if (match && match[1]) {
        isYouTubeThumbnail = true;
        youtubeVideoId = match[1];
        break;
      }
    }
    
    // 패턴 매칭 실패 시 도메인 체크 + 11자리 ID 추출
    if (!isYouTubeThumbnail) {
      const isYouTubeDomain = post.thumbnail.includes('youtube.com') || 
                              post.thumbnail.includes('ytimg.com') ||
                              post.thumbnail.includes('youtu.be');
      
      if (isYouTubeDomain) {
        // YouTube 비디오 ID는 정확히 11자리
        const idMatch = post.thumbnail.match(/([a-zA-Z0-9_-]{11})/);
        if (idMatch) {
          isYouTubeThumbnail = true;
          youtubeVideoId = idMatch[1];
        }
      }
    }
  }
  
  // YouTube 비디오인 경우 Reddit 스타일 레이아웃
  if (youtubeVideoId) {
    return (
      <article className="border-b border-gray-200 dark:border-gray-800 py-6 sm:py-8 first:pt-0">
        <div className="flex flex-col">
          {/* Header - Author Info와 제목 */}
          <div className="mb-4">
            {/* Author Info - 날짜 제거 */}
            {post.author && (
              <div className="flex items-center gap-2 mb-2">
                <UserLinkWithTooltip 
                  userId={post.author.id} 
                  username={post.author.username}
                  blogSlug={post.blog?.slug}
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      profileImage={post.author.profileImage}
                      username={post.author.username}
                      size="sm"
                    />
                    <span className="text-[15px] text-gray-700 dark:text-[#9CA3AF] font-medium">
                      {post.author.username}
                    </span>
                  </div>
                </UserLinkWithTooltip>
              </div>
            )}

            {/* 제목 - YouTube 포스트는 더 큰 제목 */}
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-tight mb-1">
              <Link
                href={post.blog?.slug ? `/${post.blog.slug}/${post.slug || post.id}` : '#'}
                className="hover:text-primary transition-colors"
              >
                {searchQuery ? (
                  <span dangerouslySetInnerHTML={createHighlightedHTML(post.title, searchQuery)} />
                ) : (
                  post.title
                )}
              </Link>
            </h2>
          </div>
          
          {/* YouTube 비디오 플레이어 - 반응형 */}
          <div className="w-full mb-7 max-w-full">
            <div className="w-full max-w-[685px] mx-auto">
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
          
          {/* 하단 고정 영역 - 일반 포스트와 동일한 구조 */}
          <div>
            {/* 메타 정보 (날짜,조회,좋아요,댓글) */}
            <div className="flex flex-wrap items-center text-[13px] text-gray-500 dark:text-[#cccccc] gap-2 sm:gap-4 mb-2">
              <span className="whitespace-nowrap">
                {formatRelativeTime(post.publishedAt || post.createdAt)}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-3 h-3" />
                {post.viewCount || 0}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiHeart className="w-3 h-3" />
                {post.likeCount || 0}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiMessageCircle className="w-3 h-3" />
                {post.commentCount || 0}
              </span>
              {post.isEditorPick && (
                <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 whitespace-nowrap">
                  <FaStar className="w-3 h-3" />
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

            {/* 버튼들 - 메타 정보 바로 아래 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href={post.blog?.slug ? `/${post.blog.slug}/${post.slug || post.id}` : '#'}
                className="text-xs text-gray-600 hover:text-amber-800 whitespace-nowrap"
              >
                더보기
              </Link>

              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.id)}
                    className="text-xs text-gray-600 hover:text-amber-800 whitespace-nowrap"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    disabled={isDeleting}
                    className="text-xs text-gray-600 hover:text-red-600 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isDeleting ? '삭제중...' : '삭제'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </article>
    );
  }

  // 일반 포스트 레이아웃 (기존 코드)
  return (
    <article className="border-b border-gray-200 dark:border-gray-800 py-6 sm:py-4 first:pt-0">
      <div className={`flex ${post.thumbnail ? 'flex-row gap-6 sm:gap-12' : 'flex-col'}`}>
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Author Info - 제목 위에 배치 */}
          {post.author && (
            <div className="flex items-center gap-2 mb-3">
              <UserLinkWithTooltip
                userId={post.author.id}
                username={post.author.username}
                blogSlug={post.blog?.slug}
              >
                <div className="flex items-center gap-2">
                  {/* Profile Image - 공통 UserAvatar 사용 */}
                  <UserAvatar
                    profileImage={post.author.profileImage}
                    username={post.author.username}
                    size="sm"
                  />
                  {/* Author Name */}
                  <span className="text-[15px] text-gray-700 dark:text-[#9CA3AF] font-medium">
                    {post.author.username}
                  </span>
                </div>
              </UserLinkWithTooltip>
            </div>
          )}

          <h2 className="text-lg sm:text-xl font-bold text-foreground mb-2 sm:mb-3 leading-tight line-clamp-2 break-words">
            <Link
              href={post.blog?.slug ? `/${post.blog.slug}/${post.slug || post.id}` : '#'}
              className="hover:text-primary transition-colors block"
            >
              {searchQuery ? (
                <span dangerouslySetInnerHTML={createHighlightedHTML(post.title, searchQuery)} />
              ) : (
                post.title
              )}
            </Link>
          </h2>

          {displayContent && (
            <p
              className="text-[15px] text-foreground leading-relaxed line-clamp-3 break-words mb-7"
              dangerouslySetInnerHTML={
                searchQuery
                  ? { __html: highlightAndTruncate(displayContent, searchQuery, 200) }
                  : { __html: displayContent }
              }
            />
          )}
          {!displayContent && (
            <p className="text-[15px] text-gray-400 italic leading-relaxed line-clamp-3 break-words mb-7">
              내용 미리보기가 없습니다.
            </p>
          )}

          {/* 하단 고정 영역 - 보더라인에 붙게 배치 */}
          <div>
            {/* 메타 정보 (날짜,조회,좋아요,댓글) - 작성자 정보 제거 */}
            <div className="flex flex-wrap items-center text-[13px] text-gray-500 dark:text-[#cccccc] gap-2 sm:gap-4 mb-2">
              <span className="whitespace-nowrap">
                {formatRelativeTime(post.publishedAt || post.createdAt)}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiEye className="w-3 h-3" />
                {post.viewCount || 0}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiHeart className="w-3 h-3" />
                {post.likeCount || 0}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiMessageCircle className="w-3 h-3" />
                {post.commentCount || 0}
              </span>
              {post.isEditorPick && (
                <span className="flex items-center gap-1 text-amber-500 dark:text-amber-400 whitespace-nowrap">
                  <FaStar className="w-3 h-3" />
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
            
            {/* 버튼들 - 메타 정보 바로 아래 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link
                href={post.blog?.slug ? `/${post.blog.slug}/${post.slug || post.id}` : '#'}
                className="text-xs text-gray-600 hover:text-amber-800 whitespace-nowrap"
              >
                더보기
              </Link>
              
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.id)}
                    className="text-xs text-gray-600 hover:text-amber-800 whitespace-nowrap"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(post.id)}
                    disabled={isDeleting}
                    className="text-xs text-gray-600 hover:text-red-600 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isDeleting ? '삭제중...' : '삭제'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Thumbnail - 모바일에서 제목 위치에 맞춰 정렬, 데스크톱 210x197 */}
        {post.thumbnail && (
          <div className="flex-shrink-0 mt-[52px] sm:mt-0">
            <div className="block sm:hidden" style={{ width: '100px', height: '94px' }}>
              <OptimizedImage
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-full rounded-lg object-contain"
                aspectRatio={100/94}
                sizes="100px"
                priority={false}
              />
            </div>
            <div className="hidden sm:block" style={{ width: '210px', height: '197px' }}>
              <OptimizedImage
                src={post.thumbnail}
                alt={post.title}
                className="w-full h-full rounded-lg object-contain"
                aspectRatio={210/197}
                sizes="210px"
                priority={false}
              />
            </div>
          </div>
        )}
      </div>
    </article>
  );
});

export default PostArticle; 