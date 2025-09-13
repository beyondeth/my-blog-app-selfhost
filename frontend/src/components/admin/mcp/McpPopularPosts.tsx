'use client';

import Link from 'next/link';
import { FileText, Eye, Bot } from 'lucide-react';
import { McpPopularPost } from '@/types/mcp';
import { AI_CLIENT_COLORS, AI_CLIENT_LABELS, AIClientType } from '@/types/mcp';

interface McpPopularPostsProps {
  posts: McpPopularPost[];
}

export default function McpPopularPosts({ posts }: McpPopularPostsProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">AI가 많이 읽은 포스트</h3>
        <FileText className="h-5 w-5 text-gray-400" />
      </div>
      
      <div className="space-y-3">
        {posts.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">데이터가 없습니다</p>
        ) : (
          posts.map((post, index) => (
            <div
              key={post.postId}
              className="flex items-start justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-500">#{index + 1}</span>
                  <Link
                    href={`/blog/${post.blogSlug}/posts/${post.postSlug}`}
                    target="_blank"
                    className="text-sm font-medium text-gray-900 hover:text-blue-600 truncate"
                  >
                    {post.postTitle || post.postSlug}
                  </Link>
                </div>
                
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {post.readCount}회 읽음
                  </span>
                  <span className="flex items-center gap-1">
                    <Bot className="h-3 w-3" />
                    {post.uniqueClients}개 AI
                  </span>
                </div>
                
                {post.aiClients && post.aiClients.length > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    {post.aiClients.map((client) => (
                      <span
                        key={client}
                        className="px-2 py-0.5 text-xs font-medium text-white rounded-full"
                        style={{ backgroundColor: AI_CLIENT_COLORS[client] }}
                        title={AI_CLIENT_LABELS[client]}
                      >
                        {AI_CLIENT_LABELS[client].substring(0, 1)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="ml-4 text-right">
                <p className="text-xs text-gray-500">
                  {new Date(post.lastAccessedAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}