"use client";

import React from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import OptimizedImage from '@/components/ui/OptimizedImage';
import UserAvatar from '@/components/ui/UserAvatar';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';
import { FiHeart, FiMessageCircle } from 'react-icons/fi';

interface PostArticleProps {
  post: Post;
  isAdmin: boolean;
  isAuthenticated: boolean;
  userId?: string;
  onEdit: (slug: string) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
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
}: PostArticleProps) {
  // HTML 태그를 제거한 순수 텍스트
  const cleanContent = stripHtmlTags(post.content || '');
  
  // 3줄까지만 표시 (한 줄당 50자, 총 150자)
  const maxLength = 150; // 50자 × 3줄
  const displayContent = cleanContent && cleanContent.length > maxLength 
    ? cleanContent.substring(0, maxLength) + '...' 
    : cleanContent || '';
  
  // YouTube 썸네일인지 확인하고 비디오 ID 추출
  const isYouTubeThumbnail = post.thumbnail && (
    post.thumbnail.includes('img.youtube.com') || 
    post.thumbnail.includes('ytimg.com')
  );
  
  let youtubeVideoId = null;
  if (isYouTubeThumbnail && post.thumbnail) {
    // URL에서 비디오 ID 추출: https://img.youtube.com/vi/{videoId}/maxresdefault.jpg
    const match = post.thumbnail.match(/\/vi\/([a-zA-Z0-9_-]+)\//);
    if (match) {
      youtubeVideoId = match[1];
    }
  }
  
  // YouTube 비디오인 경우 Reddit 스타일 레이아웃
  if (youtubeVideoId) {
    return (
      <article className="border-b border-gray-200 py-6 sm:py-4 first:pt-0">
        <div className="flex flex-col">
          {/* Author Info와 제목 */}
          <div className="mb-4">
            {post.author && (
              <div className="flex items-center gap-2 mb-3">
                <UserLinkWithTooltip 
                  userId={post.author.id} 
                  username={post.author.username}
                  blogSlug={post.blog?.slug}
                >
                  <div className="flex items-center gap-2">
                    <UserAvatar
                      profileImage={post.author.profileImage}
                      username={post.author.username}
                      size="xs"
                    />
                    <span className="text-sm text-gray-700 font-medium">
                      {post.author.username}
                    </span>
                  </div>
                </UserLinkWithTooltip>
              </div>
            )}
            
            <h2 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
              <Link 
                href={post.blog?.slug ? `/blog/${post.blog.slug}/posts/${post.slug || post.id}` : `/posts/${post.slug || post.id}`}
                className="hover:text-amber-800 transition-colors"
              >
                {post.title}
              </Link>
            </h2>
          </div>
          
          {/* YouTube 비디오 플레이어 - 480x480 고정 크기 */}
          <div className="w-full flex justify-center mb-4">
            <div className="relative" style={{ width: '480px', maxWidth: '100%', height: '480px' }}>
              <iframe
                src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0&modestbranding=1`}
                title={post.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full rounded-lg"
                style={{ aspectRatio: '1/1' }}
              />
            </div>
          </div>
          
          {/* 메타 정보와 버튼들 */}
          <div>
            <div className="flex flex-wrap items-center text-xs text-gray-500 gap-2 sm:gap-4 mb-2">
              <span className="whitespace-nowrap">
                {new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR')}
              </span>
              <span className="whitespace-nowrap">조회 {post.viewCount || 0}</span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiHeart className="w-3 h-3" />
                {post.likeCount || 0}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiMessageCircle className="w-3 h-3" />
                {post.commentCount || 0}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link 
                href={post.blog?.slug ? `/blog/${post.blog.slug}/posts/${post.slug || post.id}` : `/posts/${post.slug || post.id}`}
                className="text-xs text-gray-600 hover:text-amber-800 whitespace-nowrap"
              >
                더보기
              </Link>
              
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.slug || post.id.toString())}
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
    <article className="border-b border-gray-200 py-6 sm:py-4 first:pt-0">
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
                    size="xs"
                  />
                  {/* Author Name */}
                  <span className="text-sm text-gray-700 font-medium">
                    {post.author.username}
                  </span>
                </div>
              </UserLinkWithTooltip>
            </div>
          )}
          
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 leading-tight line-clamp-2 break-words">
            <Link 
              href={post.blog?.slug ? `/blog/${post.blog.slug}/posts/${post.slug || post.id}` : `/posts/${post.slug || post.id}`}
              className="hover:text-amber-800 transition-colors block"
            >
              {post.title}
            </Link>
          </h2>
          
          <p className="text-sm text-gray-900 leading-relaxed line-clamp-3 break-words mb-7">
            {displayContent}
          </p>
          
          {/* 하단 고정 영역 - 보더라인에 붙게 배치 */}
          <div>
            {/* 메타 정보 (날짜,조회,좋아요,댓글) - 작성자 정보 제거 */}
            <div className="flex flex-wrap items-center text-xs text-gray-500 gap-2 sm:gap-4 mb-2">
              <span className="whitespace-nowrap">
                {new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR')}
              </span>
              <span className="whitespace-nowrap">조회 {post.viewCount || 0}</span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiHeart className="w-3 h-3" />
                {post.likeCount || 0}
              </span>
              <span className="flex items-center gap-1 whitespace-nowrap">
                <FiMessageCircle className="w-3 h-3" />
                {post.commentCount || 0}
              </span>
            </div>
            
            {/* 버튼들 - 메타 정보 바로 아래 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link 
                href={post.blog?.slug ? `/blog/${post.blog.slug}/posts/${post.slug || post.id}` : `/posts/${post.slug || post.id}`}
                className="text-xs text-gray-600 hover:text-amber-800 whitespace-nowrap"
              >
                더보기
              </Link>
              
              {(isAdmin || (isAuthenticated && post.author?.id === userId)) && (
                <>
                  <button
                    onClick={() => onEdit(post.slug || post.id.toString())}
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
        
        {/* Thumbnail - 모바일 100x94, 데스크톱 210x197 */}
        {post.thumbnail && (
          <div className="flex-shrink-0">
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