'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Eye, Heart, MessageCircle, TrendingUp, Bot } from 'lucide-react';
import { useAIPopularPosts } from '@/hooks/useAIPopularPosts';
import { AI_CLIENT_COLORS, AI_CLIENT_LABELS, AIClientType } from '@/types/mcp';

export default function McpPopularAIPosts() {
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const { data, isLoading, error } = useAIPopularPosts(period, 5);

  const posts = data?.posts || [];

  // AI 타입 추출 함수
  const getAIType = (tags: string[]): AIClientType => {
    const aiTag = tags?.find(tag => tag.startsWith('ai:'));
    if (aiTag) {
      const type = aiTag.replace('ai:', '') as AIClientType;
      return type;
    }
    return 'unknown';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold">인기 AI 포스트</h3>
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setPeriod('daily')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              period === 'daily'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            일일
          </button>
          <button
            onClick={() => setPeriod('weekly')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              period === 'weekly'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            주간
          </button>
          <button
            onClick={() => setPeriod('monthly')}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              period === 'monthly'
                ? 'bg-black text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            월간
          </button>
        </div>
      </div>

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
        <div className="text-center py-8 text-gray-500">
          <Bot className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">인기 포스트를 불러올 수 없습니다.</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Bot className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">아직 AI가 작성한 인기 포스트가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: any, index: number) => {
            const aiType = getAIType(post.tags);
            return (
              <div key={post.id} className="flex gap-3 pb-3 border-b border-gray-100 last:border-b-0">
                <span className="text-lg font-bold text-gray-300 w-6 text-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <Link
                    href={post.blog?.slug
                      ? `/blog/${post.blog.slug}/posts/${post.slug || post.id}`
                      : `/posts/${post.slug || post.id}`
                    }
                    className="block hover:text-blue-600 transition-colors"
                    target="_blank"
                  >
                    <h4 className="text-sm font-medium line-clamp-2 break-words">
                      {post.title}
                    </h4>
                  </Link>

                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="px-2 py-0.5 text-xs font-medium text-white rounded-full inline-flex items-center gap-1"
                      style={{ backgroundColor: AI_CLIENT_COLORS[aiType] }}
                    >
                      <Bot className="h-3 w-3" />
                      {AI_CLIENT_LABELS[aiType]}
                    </span>

                    {post.qualityScore != null && (
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          post.qualityScore >= 80
                            ? 'bg-green-100 text-green-700'
                            : post.qualityScore >= 60
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        title="콘텐츠 품질 점수"
                      >
                        {post.qualityScore}점
                      </span>
                    )}

                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        <span>{post.viewCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        <span>{post.likeCount || 0}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        <span>{post.commentCount || 0}</span>
                      </div>
                    </div>
                  </div>

                  {post.author && (
                    <p className="text-xs text-gray-400 mt-1">
                      작성자: {post.author.username || post.author.email}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}