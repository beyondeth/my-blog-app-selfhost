"use client";

import React from 'react';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import SidebarSection from './SidebarSection';

interface BlogRecommendation {
  id: string;
  slug: string;
  name: string;
  description?: string;
  owner?: {
    username: string;
    profileImage?: string;
  };
}

interface BlogRecommendationsProps {
  blogs?: BlogRecommendation[];
  className?: string;
}

const BlogRecommendations = React.memo(function BlogRecommendations({ 
  blogs = [],
  className,
}: BlogRecommendationsProps) {
  if (blogs.length === 0) {
    return null;
  }

  return (
    <SidebarSection title="More blogs" className={className}>
      <div className="space-y-3">
        {blogs.map((blog) => (
          <Link
            key={blog.id}
            href={`/${blog.slug}`}
            className="flex items-start space-x-3 hover:bg-gray-50 rounded-lg p-2 -mx-2 transition-colors"
          >
            <Avatar 
              src={blog.owner?.profileImage} 
              alt={blog.owner?.username || blog.name}
              size="sm"
              className="flex-shrink-0 mt-0.5"
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-gray-900 truncate">
                {blog.name}
              </div>
              {blog.description && (
                <div className="text-xs text-gray-500 line-clamp-2">
                  {blog.description}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </SidebarSection>
  );
});

export default BlogRecommendations;
