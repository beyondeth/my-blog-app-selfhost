'use client';

import { useCommunityPosts } from '@/hooks/community/useCommunityPosts';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiEye, FiMessageSquare, FiThumbsUp } from 'react-icons/fi';
import { CommunityPost } from '@/types/community';

interface CommunityTrendingSectionProps {
  communitySlug: string;
  currentPostId: string;
}

export default function CommunityTrendingSection({
  communitySlug,
  currentPostId,
}: CommunityTrendingSectionProps) {
  // 인기 글 20개를 가져와서 썸네일 있는 것만 필터링 후 3개 노출
  const { data: postsData, isLoading } = useCommunityPosts(communitySlug, {
    sortBy: 'hot',
    limit: 20,
  });

  // 현재 게시물 제외 && 썸네일 있는 게시물만 필터링 && 최대 3개 선택
  const trendingPosts = postsData?.pages[0]?.items
    .filter((post: CommunityPost) => post.id !== currentPostId && !!post.thumbnailImage)
    .slice(0, 3) || [];

  if (isLoading) {
    return (
      <div className="border-t border-gray-100 dark:border-gray-800">
        <div className="py-12">
          <div className="flex justify-between items-center mb-8">
            <div className="h-6 w-48 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (trendingPosts.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-gray-100 dark:border-gray-800">
      <div className="py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            이 커뮤니티의 인기 글
          </h2>
          <Link
            href={`/c/${communitySlug}`}
            className="inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-[#264653] text-white hover:bg-[#1e3a45] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#5aa89a] transition-all transform hover:-translate-y-0.5 shadow-sm"
          >
            더보기
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {trendingPosts.map((post: CommunityPost) => (
            <Link
              key={post.id}
              href={`/c/${communitySlug}/posts/${post.slug}`}
              className="group flex flex-col h-full"
            >
              {/* 썸네일 */}
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl mb-4 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                {post.thumbnailImage && (
                  <Image
                    src={post.thumbnailImage.url}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                )}
              </div>

              {/* 메타정보 */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
                <span className="font-medium text-amber-600 dark:text-amber-500">
                  {post.flair?.name || 'General'}
                </span>
                <span>•</span>
                <time>
                  {formatDistanceToNow(new Date(post.createdAt), {
                    addSuffix: true,
                    locale: ko,
                  })}
                </time>
              </div>

              {/* 제목 */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 line-clamp-2 mb-2 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors leading-tight">
                {post.title}
              </h3>

              {/* 요약 (없으면 빈 공간 유지) */}
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4 min-h-[1.25rem]">
                {post.excerpt || ''}
              </p>

              {/* 하단 좋아요/댓글/조회수 */}
              <div className="mt-auto pt-3 flex items-center gap-4 text-xs font-medium text-gray-400 border-t border-gray-100 dark:border-gray-800/50">
                <span className="flex items-center gap-1.5">
                  <FiEye className="w-3.5 h-3.5" />
                  {post.viewCount > 999
                    ? `${(post.viewCount / 1000).toFixed(1)}k`
                    : post.viewCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <FiThumbsUp className="w-3.5 h-3.5" />
                  {post.upvoteCount > 999
                    ? `${(post.upvoteCount / 1000).toFixed(1)}k`
                    : post.upvoteCount}
                </span>
                <span className="flex items-center gap-1.5">
                   <FiMessageSquare className="w-3.5 h-3.5" />
                   {post.commentCount > 999
                    ? `${(post.commentCount / 1000).toFixed(1)}k`
                    : post.commentCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
