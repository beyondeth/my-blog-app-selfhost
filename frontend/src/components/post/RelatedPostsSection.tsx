'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import Image from 'next/image';
import { getRelatedPosts } from '@/services/api/posts.service';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { FiEye, FiThumbsUp } from 'react-icons/fi';
import { normalizeImageUrl } from '@/utils/imageUtils';

interface RelatedPostsSectionProps {
  postId: string;
  blogSlug: string;
  authorName: string;
}

export default function RelatedPostsSection({
  postId,
  blogSlug,
  authorName,
}: RelatedPostsSectionProps) {
  const { data: posts, isLoading } = useQuery({
    queryKey: ['relatedPosts', postId],
    queryFn: () => getRelatedPosts(postId, 6),
    staleTime: 1000 * 60 * 5, // 5분 캐시
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-12 border-t border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-8">
            <div className="h-6 w-32 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-100 dark:bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-gray-100 dark:border-gray-800">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {authorName}의 다른 글
          </h2>
          <Link
            href={`/${blogSlug}`}
            className="inline-flex px-4 py-1.5 rounded-full text-sm font-medium bg-[#264653] text-white hover:bg-[#1e3a45] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:hover:bg-[#5aa89a] transition-all transform hover:-translate-y-0.5 shadow-sm"
          >
            더보기
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-12">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/${blogSlug}/${post.slug}`}
              className="group flex flex-col h-full"
            >
              {/* 썸네일 */}
              <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl mb-4 border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                {post.thumbnail ? (
                  <Image
                    src={normalizeImageUrl(post.thumbnail)}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  // 만약 백엔드 필터링을 통과했으나 이미지가 없는 예외적인 경우 (Fallback)
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center p-6">
                    <span className="text-sm font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                        {post.category || 'Vibe Coding'}
                    </span>
                  </div>
                )}
              </div>

              {/* 메타정보 */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2.5">
                <span className="font-medium text-amber-600 dark:text-amber-500">
                  {post.category || 'Blog'}
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

              {/* 요약 */}
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed mb-4">
                {post.excerpt || ''}
              </p>

              {/* 하단 좋아요/조회수 */}
              <div className="mt-auto pt-3 flex items-center gap-4 text-xs font-medium text-gray-400 border-t border-gray-100 dark:border-gray-800/50">
                <span className="flex items-center gap-1.5">
                  <FiEye className="w-3.5 h-3.5" />
                  {post.viewCount > 999
                    ? `${(post.viewCount / 1000).toFixed(1)}k`
                    : post.viewCount}
                </span>
                <span className="flex items-center gap-1.5">
                  <FiThumbsUp className="w-3.5 h-3.5" />
                  {post.likeCount > 999
                    ? `${(post.likeCount / 1000).toFixed(1)}k`
                    : post.likeCount}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
