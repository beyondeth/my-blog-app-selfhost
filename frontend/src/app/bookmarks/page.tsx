'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FiBookmark,
  FiCalendar,
  FiSearch,
  FiUser,
  FiEye,
  FiHeart,
  FiMessageCircle,
  FiMoreVertical,
  FiTrash2
} from 'react-icons/fi';
import { useBookmarks, useDeleteBookmark } from '@/hooks/useBookmarks';
import { useAuth } from '@/providers/AuthProviderV2';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { toast } from 'sonner';

export default function BookmarksPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'oldest'>('recent');
  const [page, setPage] = useState(1);
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  // 인증 로딩 중에는 리다이렉트하지 않음
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login?redirect=/bookmarks');
    }
  }, [user, authLoading, router]);

  // 북마크 목록 가져오기
  const { data, isLoading, error } = useBookmarks(page, 20);
  const deleteBookmarkMutation = useDeleteBookmark();

  // 북마크 삭제 핸들러
  const handleDeleteBookmark = async (postId: string) => {
    try {
      await deleteBookmarkMutation.mutateAsync(postId);
      setShowDeleteMenu(null);
    } catch (error) {
      toast.error('북마크 삭제에 실패했습니다.');
    }
  };

  // 포스트 클릭 핸들러
  const handlePostClick = (post: any) => {
    // 포스트 상세 페이지로 이동
    if (post.blog?.slug && (post.slug || post.id)) {
      router.push(`/blog/${post.blog.slug}/posts/${post.slug || post.id}`);
    }
  };

  // 필터링된 포스트
  // 백엔드가 직접 post 데이터를 items에 담아서 보냄
  const filteredPosts = data?.items?.filter((post: any) => {
    if (!post) return false;

    // 검색 필터
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const titleMatch = post.title?.toLowerCase().includes(query);
      const contentMatch = post.excerpt?.toLowerCase().includes(query);
      const tagsMatch = post.tags?.some((tag: string) => tag.toLowerCase().includes(query));

      if (!titleMatch && !contentMatch && !tagsMatch) return false;
    }

    // 현재는 전체 북마크만 있음
    return true;
  }) || [];

  // 정렬
  const sortedPosts = [...filteredPosts].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime();
      case 'oldest':
        return new Date(a.bookmarkedAt).getTime() - new Date(b.bookmarkedAt).getTime();
      case 'popular':
        return (b.likeCount || 0) - (a.likeCount || 0);
      default:
        return 0;
    }
  });

  // 인증 로딩 중이거나 북마크 로딩 중일 때
  if (authLoading || isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorMessage message="북마크를 불러오는데 실패했습니다." />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* 헤더 영역 - 검색, 필터, 정렬 통합 */}
      <div className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* 필터, 검색, 정렬 영역 */}
          <div className="py-4 flex items-center justify-end gap-3">
            {/* 검색 */}
            <div className="relative">
              <input
                type="text"
                placeholder="북마크 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                style={{ backgroundColor: '#f7f7f5' }}
              />
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>

            {/* 정렬 옵션 */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'oldest')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              style={{ backgroundColor: '#f7f7f5' }}
            >
              <option value="recent">최근 추가순</option>
              <option value="oldest">오래된 순</option>
              <option value="popular">인기순</option>
            </select>

            {/* 전체 북마크 버튼 */}
            <button
              className="flex items-center px-4 py-2 text-sm font-medium rounded-lg text-white"
              style={{ backgroundColor: '#1a1a1a' }}
            >
              <FiBookmark className="w-4 h-4" />
              <span className="ml-2">전체 북마크</span>
              <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full text-white"
                style={{ backgroundColor: 'rgba(255, 255, 255, 0.2)' }}>
                {data?.total || 0}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 메인 컨텐츠 - 전체 너비 사용 */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto p-6">
          {sortedPosts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedPosts.map((post: any) => {
                if (!post) return null;

                return (
                  <article
                    key={post.id}
                    className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow cursor-pointer relative group h-fit"
                    style={{ backgroundColor: '#f7f7f5' }}
                    onClick={() => handlePostClick(post)}
                  >
                      {/* 삭제 메뉴 버튼 */}
                      <div className="absolute top-4 right-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteMenu(showDeleteMenu === post.id ? null : post.id);
                          }}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiMoreVertical className="w-4 h-4" />
                        </button>

                        {showDeleteMenu === post.id && (
                          <div className="absolute right-0 mt-1 w-48 rounded-lg shadow-lg border border-gray-200 py-1 z-10"
                            style={{ backgroundColor: '#f7f7f5' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBookmark(post.id);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <FiTrash2 className="mr-2 w-4 h-4" />
                              북마크 삭제
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 포스트 정보 */}
                      <div className="pr-8">
                        <h2 className="text-base font-semibold text-gray-900 mb-2 line-clamp-2">
                          {post.title}
                        </h2>

                        {post.excerpt && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                            {post.excerpt}
                          </p>
                        )}

                        {/* 메타 정보 */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          {post.blog && (
                            <div className="flex items-center">
                              <FiUser className="mr-1 w-3 h-3" />
                              <span>{post.blog.name || post.author?.username}</span>
                            </div>
                          )}

                          <div className="flex items-center">
                            <FiCalendar className="mr-1 w-3 h-3" />
                            <span>
                              {new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR')}
                            </span>
                          </div>

                          <div className="flex items-center">
                            <FiEye className="mr-1 w-3 h-3" />
                            <span>{post.viewCount || 0}</span>
                          </div>

                          <div className="flex items-center">
                            <FiHeart className="mr-1 w-3 h-3" />
                            <span>{post.likeCount || 0}</span>
                          </div>

                          <div className="flex items-center">
                            <FiMessageCircle className="mr-1 w-3 h-3" />
                            <span>{post.commentCount || 0}</span>
                          </div>

                          {/* 북마크 추가 시간 */}
                          <div className="flex items-center text-blue-600">
                            <FiBookmark className="mr-1 w-3 h-3" />
                            <span>
                              {new Date(post.bookmarkedAt).toLocaleDateString('ko-KR')} 추가
                            </span>
                          </div>
                        </div>

                        {/* 태그 */}
                        {post.tags && post.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-3">
                            {post.tags.slice(0, 3).map((tag: string, index: number) => (
                              <span
                                key={index}
                                className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded"
                              >
                                #{tag}
                              </span>
                            ))}
                            {post.tags.length > 3 && (
                              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium text-gray-500">
                                +{post.tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <FiBookmark className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">북마크가 없습니다</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery
                    ? '검색 결과가 없습니다. 다른 검색어를 시도해보세요.'
                    : '마음에 드는 포스트를 북마크에 추가해보세요.'}
                </p>
                <Link
                  href="/"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  포스트 둘러보기
                </Link>
              </div>
            </div>
          )}

          {/* 페이지네이션 */}
          {data?.totalPages > 1 && (
            <div className="flex justify-center mt-8 space-x-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                이전
              </button>

              {Array.from({ length: Math.min(5, data.totalPages) }, (_, i) => {
                const pageNum = i + Math.max(1, page - 2);
                if (pageNum > data.totalPages) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 text-sm border rounded-md ${
                      page === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage(Math.min(data.totalPages, page + 1))}
                disabled={page === data.totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}