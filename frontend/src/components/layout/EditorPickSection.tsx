"use client";

import React from 'react';
import Link from 'next/link';
import { FiEye, FiHeart, FiMessageCircle } from 'react-icons/fi';
import { FaStar } from 'react-icons/fa';
import SidebarSection from './SidebarSection';
import { useEditorPicks } from '@/hooks/useEditorPicks';
import OptimizedImage from '@/components/ui/OptimizedImage';

/**
 * Editor's Pick 섹션 컴포넌트
 * @description 관리자가 선정한 추천 포스트를 표시하는 사이드바 섹션
 * PopularPostsSection과 동일한 디자인/레이아웃 사용
 */
const EditorPickSection = React.memo(function EditorPickSection() {
  const { data, isLoading, error } = useEditorPicks(5); // 최대 5개 노출

  const posts = data?.posts || [];

  return (
    <SidebarSection
      title={
        <div className="flex items-center gap-2">
          <FaStar className="w-4 h-4 text-amber-500" />
          <span>Editor's Pick</span>
        </div>
      }
    >
      {isLoading ? (
        // 로딩 스켈레톤 UI
        <div className="space-y-3">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="animate-pulse">
              <div className="flex gap-3">
                <div className="w-6 h-6 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        // 에러 상태
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">Editor's Pick을 불러올 수 없습니다.</p>
        </div>
      ) : posts.length === 0 ? (
        // 빈 상태
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">아직 선정된 포스트가 없습니다.</p>
        </div>
      ) : (
        // 포스트 목록
        <div className="space-y-3">
          {posts.map((post: any, index: number) => (
            <div
              key={post.id}
              className="flex gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
            >
              {/* 순번 표시 */}
              <span className="text-lg font-bold text-gray-300 w-6 text-center">
                {index + 1}
              </span>

              <div className="flex-1 min-w-0">
                {/* 썸네일 이미지 (있을 경우) */}
                {post.thumbnail && (
                  <div className="mb-2">
                    {/* 모바일 버전 */}
                    <div className="block sm:hidden" style={{ width: '100px', height: '94px' }}>
                      <OptimizedImage
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full rounded-lg object-contain"
                        aspectRatio={100/94}
                        sizes="100px"
                        priority={index < 3} // 상위 3개는 우선 로딩
                      />
                    </div>

                    {/* 데스크톱 버전 */}
                    <div className="hidden sm:block" style={{ width: '210px', height: '197px' }}>
                      <OptimizedImage
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full rounded-lg object-contain"
                        aspectRatio={210/197}
                        sizes="210px"
                        priority={index < 3}
                      />
                    </div>
                  </div>
                )}

                {/* 포스트 제목 */}
                <Link
                  href={`/${post.blog.slug}/${post.slug || post.id}`}
                  className="block hover:text-gray-600 transition-colors"
                >
                  <h4 className="text-[15px] font-medium line-clamp-2 break-words">
                    {post.title}
                  </h4>
                </Link>

                {/* 통계 정보 (조회수, 좋아요, 댓글) */}
                <div className="flex items-center gap-3 text-[13px] text-gray-500 dark:text-[#cccccc] mt-2">
                  <div className="flex items-center gap-1">
                    <FiEye className="w-3 h-3" />
                    <span>{post.viewCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiHeart className="w-3 h-3" />
                    <span>{post.likeCount || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FiMessageCircle className="w-3 h-3" />
                    <span>{post.commentCount || 0}</span>
                  </div>
                </div>

                {/* 작성자 정보 */}
                {post.author && (
                  <p className="text-xs text-gray-400 mt-1">
                    {post.author.username || post.author.email}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </SidebarSection>
  );
});

export default EditorPickSection;
