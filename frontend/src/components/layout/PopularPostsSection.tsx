"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { FiBarChart2, FiEye, FiHeart, FiMessageCircle } from 'react-icons/fi';
import SidebarSection from './SidebarSection';
import { usePopularPosts } from '@/hooks/usePopularPosts';
import OptimizedImage from '@/components/ui/OptimizedImage';

const PopularPostsSection = React.memo(function PopularPostsSection() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const { data, isLoading, error } = usePopularPosts(period);
  
  const posts = data?.posts || [];

  return (
    <SidebarSection 
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <FiBarChart2 className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span>인기 포스트</span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setPeriod('daily')}
              className={`px-2 py-0.5 text-[13px] rounded transition-colors ${
                period === 'daily'
                  ? 'bg-black text-white dark:bg-gray-700 dark:text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-black dark:text-gray-400 dark:hover:bg-gray-900'
              }`}
              aria-label="일일 인기 포스트"
            >
              일일
            </button>
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-2 py-0.5 text-[13px] rounded transition-colors ${
                period === 'weekly'
                  ? 'bg-black text-white dark:bg-gray-700 dark:text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-black dark:text-gray-400 dark:hover:bg-gray-900'
              }`}
              aria-label="주간 인기 포스트"
            >
              주간
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-2 py-0.5 text-[13px] rounded transition-colors ${
                period === 'monthly'
                  ? 'bg-black text-white dark:bg-gray-700 dark:text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-black dark:text-gray-400 dark:hover:bg-gray-900'
              }`}
              aria-label="월간 인기 포스트"
            >
              월간
            </button>
          </div>
        </div>
      }
    >
      {isLoading ? (
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
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">인기 포스트를 불러올 수 없습니다.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-4 text-gray-500">
          <p className="text-sm">아직 인기 포스트가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any, index: number) => (
            <div key={post.id} className="flex gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
              <span className="text-lg font-bold text-gray-300 w-6 text-center">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                {post.thumbnail && (
                  <div className="mb-2">
                    <div className="block sm:hidden" style={{ width: '100px', height: '94px' }}>
                      <OptimizedImage
                        src={post.thumbnail}
                        alt={post.title}
                        className="w-full h-full rounded-lg object-contain"
                        aspectRatio={100/94}
                        sizes="100px"
                        priority={index < 3}
                      />
                    </div>
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
                <Link
                  href={`/${post.blog.slug}/${post.slug || post.id}`}
                  className="block hover:text-gray-600 transition-colors"
                >
                  <h4 className="text-[15px] font-medium line-clamp-2 break-words">
                    {post.title}
                  </h4>
                </Link>
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

export default PopularPostsSection;