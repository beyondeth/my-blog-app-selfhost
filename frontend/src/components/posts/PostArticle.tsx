"use client";

import React from 'react';
import Link from 'next/link';
import { Post } from '@/types';
import OptimizedImage from '@/components/ui/OptimizedImage';
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
  
  return (
    <article className="border-b border-gray-200 py-6 sm:py-4 first:pt-0">
      <div className={`flex ${post.thumbnail ? 'flex-row gap-6 sm:gap-12' : 'flex-col'}`}>
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-2 sm:mb-3 leading-tight line-clamp-2 break-words">
            <Link 
              href={`/posts/${post.slug || post.id}`}
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
            {/* 메타 정보 (날짜,조회,좋아요,댓글,작성자) - 고정 위치 */}
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
              {post.author && (
                <span className="whitespace-nowrap">by {post.author.username}</span>
              )}
            </div>
            
            {/* 버튼들 - 메타 정보 바로 아래 */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <Link 
                href={`/posts/${post.slug || post.id}`}
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