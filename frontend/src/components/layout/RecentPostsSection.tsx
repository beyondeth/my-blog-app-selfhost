"use client";

import React from 'react';
import Link from 'next/link';
import { FiCalendar, FiEye } from 'react-icons/fi';
import { Post } from '@/types';
import SidebarSection from './SidebarSection';

interface RecentPostsSectionProps {
  posts: Post[];
}

const RecentPostsSection = React.memo(function RecentPostsSection({ posts }: RecentPostsSectionProps) {
  return (
    <SidebarSection title="최근 포스트">
      <div className="space-y-3 sm:space-y-3">
        {posts.map((post) => (
          <div key={post.id} className="pb-3 sm:pb-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
            <Link
              href={(post as any).blog?.slug ? `/blog/${(post as any).blog.slug}/posts/${post.slug || post.id}` : `/posts/${post.slug || post.id}`}
              className="block text-sm sm:text-xs text-foreground hover:text-primary leading-relaxed line-clamp-2 break-words mb-2 transition-colors"
            >
              {post.title}
            </Link>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 dark:text-[#cccccc]">
              <div className="flex items-center">
                <FiCalendar className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {new Date(post.createdAt).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="flex items-center">
                <FiEye className="w-3 h-3 mr-1 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  {post.viewCount || 0}
                </span>
              </div>
            </div>
          </div>
        ))}
        {posts.length === 0 && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            <p className="text-sm">최근 포스트가 없습니다.</p>
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default RecentPostsSection; 