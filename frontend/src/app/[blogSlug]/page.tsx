"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, useParams, redirect } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useInfiniteCursorPosts, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useBlogBySlug, useBlogCategories } from '@/hooks/useBlogs';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import LoadMoreSection from '@/components/posts/LoadMoreSection';
import RecentPostsSection from '@/components/layout/RecentPostsSection';
import TagsSection from '@/components/layout/TagsSection';
import CategorySection from '@/components/layout/CategorySection';
import BlogOwnerCard from '@/components/layout/BlogOwnerCard';
import BlogRecommendations from '@/components/layout/BlogRecommendations';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import Spinner from '@/components/ui/Spinner';

// 클라이언트 사이드 체크 훅
function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsClient(true);
    }
  }, []);

  return isClient;
}

export default function BlogPage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const blogSlug = decodeURIComponent(params.blogSlug as string);
  // console.log('📝 [BLOG PAGE COMPONENT RENDERED] blogSlug:', blogSlug);

  const isClient = useIsClient();
  const searchParams = useSearchParams();
  const { getCacheStatus } = useNavigationCache();

  // 블로그 정보 가져오기 (React Query 캐싱 사용)
  const {
    data: blog,
    isLoading: blogLoading,
    error: blogError
  } = useBlogBySlug(blogSlug);

  // URL 정규화 처리 - 항상 올바른 형태로 리다이렉트
  useEffect(() => {
    if (!blog || !isClient) return;

    // 1. old_alias 리다이렉트 (기존 로직 유지)
    if (blog && 'shouldRedirect' in blog && blog.shouldRedirect && blog.redirectTo) {
      const queryString = searchParams.toString();
      const redirectPath = `/${blog.redirectTo}${queryString ? `?${queryString}` : ''}`;
      router.replace(redirectPath);
      return;
    }

    // 2. URL 정규화 - 항상 alias 우선
    if (!('shouldRedirect' in blog) || !blog.shouldRedirect) {
      const queryString = searchParams.toString();

      // alias가 있는 경우 /@alias로, 없는 경우 /slug로 이동
      if (blog.alias) {
        const correctPath = `/@${blog.alias}${queryString ? `?${queryString}` : ''}`;
        // 현재 URL과 정규화된 URL이 다른 경우에만 리다이렉트
        if (window.location.pathname !== correctPath) {
          router.replace(correctPath);
        }
      } else {
        const correctPath = `/${blog.slug}${queryString ? `?${queryString}` : ''}`;
        // 현재 URL과 정규화된 URL이 다른 경우에만 리다이렉트
        if (window.location.pathname !== correctPath) {
          router.replace(correctPath);
        }
      }
    }
  }, [blog, searchParams, router, isClient]);

  // 블로그의 카테고리별 포스트 개수 가져오기
  const {
    data: categories = [],
    isLoading: categoriesLoading,
    error: categoriesError
  } = useBlogCategories(blogSlug);

  // 디버그 로그
  console.log('🔍 [CATEGORIES DEBUG]', {
    blogSlug,
    categoriesLoading,
    categoriesLength: (categories as any[])?.length || 0,
    categories,
    error: categoriesError
  });

  // 삭제 다이얼로그 상태
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    postId: string | null;
    postTitle: string;
  }>({
    isOpen: false,
    postId: null,
    postTitle: ''
  });

  // URL에서 검색 파라미터 파싱
  const currentParams = isClient ? parseSearchParams(searchParams.toString()) : { page: 1 };

  // 블로그의 포스트 가져오기 (커서 페이지네이션 사용)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteCursorPosts({
    search: currentParams.search,
    category: currentParams.category,
    blogId: blog?.id, // blogId를 직접 전달하여 정확한 필터링
    sort: 'recent',
    limit: 20,
    enabled: isClient && !!blog?.id, // blog.id가 있을 때만 쿼리 실행
  });

  const deletePostMutation = useDeletePost();

  
  // 좋아요 토글 뮤테이션 (postId를 mutate 파라미터로 전달)
  const toggleLikeMutation = useTogglePostLike(() => {
    router.push('/login');
  });

  // 블로그 소유자 여부 확인
  const isBlogOwner = useMemo(() => {
    return !!(blog && user && String(blog.owner?.id) === String(user.id));
  }, [blog, user]);

  // 모든 포스트 플래튼 (커서 페이지네이션용)
  const allPosts = useMemo(() => {
    if (!data?.pages) return [];

    // 커서 페이지네이션은 각 페이지에 posts 배열이 있음
    const postsMap = new Map();
    data.pages.forEach((page: any) => {
      if (page?.posts) {
        page.posts.forEach((post: any) => {
          if (post && post.id) {
            postsMap.set(post.id, post);
          }
        });
      }
    });

    return Array.from(postsMap.values());
  }, [data?.pages]);

  // 총 포스트 수 (커서 페이지네이션 방식)
  const totalPosts = useMemo(() => {
    // 현재까지 로드된 포스트 수 계산
    let loadedCount = 0;
    let hasMore = false;

    data?.pages?.forEach((page: any) => {
      if (page?.posts) {
        loadedCount += page.posts.length;
      }
      if (page?.hasMore) {
        hasMore = true;
      }
    });

    // hasMore가 true면 더 많은 데이터가 있다는 의미
    return hasMore ? loadedCount + 1 : loadedCount;
  }, [data?.pages]);

  // 최근 포스트 (처음 5개)
  const recentPosts = useMemo(() => {
    return allPosts.slice(0, 5);
  }, [allPosts]);

  // 실제 포스트에서 태그 추출 - 메모이제이션
  const tags = useMemo(() => {
    const tagMap = new Map<string, number>();

    allPosts.forEach(post => {
      if (post && post.tags && Array.isArray(post.tags)) {
        post.tags.forEach((tag: string) => {
          if (tag && tag.trim()) {
            const trimmedTag = tag.trim();
            tagMap.set(trimmedTag, (tagMap.get(trimmedTag) || 0) + 1);
          }
        });
      }
    });

    // 태그를 빈도순으로 정렬하고 상위 20개만 반환
    return Array.from(tagMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([tag]) => tag);
  }, [allPosts]);

  const loadMorePosts = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleEditPost = useCallback((id: string) => {
    router.push(`/p/${id}/edit`);
  }, [router]);

  // 삭제 다이얼로그 열기
  const handleDeletePost = useCallback((id: string) => {
    const post = allPosts.find(p => p.id === id);
    setDeleteDialog({
      isOpen: true,
      postId: id,
      postTitle: post?.title || '게시글'
    });
  }, [allPosts]);

  // 삭제 확인
  const handleConfirmDelete = useCallback(() => {
    if (deleteDialog.postId) {
      // blogSlug를 명시적으로 전달하여 블로그 캐시 무효화 보장
      deletePostMutation.mutate({ postId: deleteDialog.postId, blogSlug }, {
        onSuccess: () => {
          toast.success('포스트가 삭제되었습니다');
          setDeleteDialog({ isOpen: false, postId: null, postTitle: '' });
        },
        onError: (error: any) => {
          // 에러 메시지 표시
          const errorMessage = error?.message || error?.error || '포스트 삭제에 실패했습니다';
          toast.error(errorMessage);
          console.error('[Delete Post Error]', {
            postId: deleteDialog.postId,
            error: error
          });
          // 에러 시에도 다이얼로그는 열어둠 (재시도 가능)
        }
      });
    }
  }, [deleteDialog.postId, deletePostMutation, blogSlug]);

  // 삭제 다이얼로그 닫기
  const handleCloseDeleteDialog = useCallback(() => {
    if (!deletePostMutation.isPending) {
      setDeleteDialog({ isOpen: false, postId: null, postTitle: '' });
    }
  }, [deletePostMutation.isPending]);

  // 좋아요 토글 핸들러
  const handleLikePost = useCallback((postId: string) => {
    toggleLikeMutation.mutate(postId);
  }, [toggleLikeMutation]);

  // 태그 클릭 처리 (검색으로 이동)
  const handleTagClick = useCallback((tag: string) => {
    // 태그를 검색어로 사용하여 URL 업데이트
    const newParams = {
      search: tag,
      page: 1,
    };

    const newUrl = createSearchUrl(newParams);
    router.push(newUrl);
  }, [router]);

  // 카테고리 클릭 처리 (블로그 내 카테고리 필터링)
  const handleCategoryClick = useCallback((category: string) => {
    // 현재 블로그 경로를 유지하면서 category 파라미터만 추가
    const params = new URLSearchParams();
    params.set('category', category);
    params.set('page', '1');

    router.push(`/${blogSlug}?${params.toString()}`);
  }, [router, blogSlug]);

  if (!isClient) {
    return <LoadingSpinner message="페이지를 불러오는 중..." />;
  }

  if (blogLoading) {
    return <LoadingSpinner message="블로그 정보를 불러오는 중..." />;
  }

  if (blogError) {
    return (
      <ErrorMessage
        message={blogError.message || '블로그 정보를 불러오는데 실패했습니다.'}
        showBackButton={true}
      />
    );
  }

  if (!blog) {
    return (
      <ErrorMessage 
        message="블로그를 찾을 수 없습니다."
        showBackButton={true}
      />
    );
  }


  if (error) {
    return (
      <ErrorMessage 
        message={`오류가 발생했습니다: ${error.message}`}
        showBackButton={false}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6 lg:pb-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 lg:gap-16">
          {/* Main Content Area - 오른쪽 사이드바를 위한 여백 확보 (right-16[64px] + w-80[320px] + 여유 16px = 400px) */}
          <main className="flex-1 min-w-0 lg:mr-[400px] pt-[70px]">
            <div className="space-y-0">
              {isLoading && allPosts.length === 0 ? (
                <div className="flex justify-center items-center py-12 sm:py-16">
                  <Spinner size="lg" />
                </div>
              ) : allPosts.length > 0 ? (
                <>
                  {allPosts.map((post) => (
                    <PostArticle
                      key={post.id}
                      post={post}
                      isAdmin={isAdmin}
                      isAuthenticated={isAuthenticated}
                      userId={user?.id}
                      onEdit={handleEditPost}
                      onDelete={handleDeletePost}
                      onLike={handleLikePost}
                      isDeleting={deletePostMutation.isPending && deleteDialog.postId === post.id}
                    />
                  ))}
                  
                  <LoadMoreSection
                    hasNextPage={hasNextPage}
                    isFetchingNextPage={isFetchingNextPage}
                    totalPosts={allPosts.length} // 커서 페이지네이션에서는 현재 로드된 개수만 표시
                    allPostsCount={allPosts.length}
                    onLoadMore={loadMorePosts}
                  />
                </>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-sm sm:text-base">
                    {isBlogOwner 
                      ? "아직 작성된 글이 없습니다. 첫 번째 글을 작성해보세요." 
                      : "아직 포스트가 없습니다."}
                  </p>
                </div>
              )}
            </div>
          </main>

          {/* Sidebar - fixed positioning with internal scroll */}
          <aside className="hidden lg:block lg:fixed lg:right-16 lg:top-40 lg:w-80 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto sidebar-scroll">
            <div className="space-y-4 sm:space-y-6">
            {/* Blog Owner Card at the top */}
            <BlogOwnerCard
              name={blog.owner?.username || blog.owner?.email || blog.name}
              username={blog.owner?.username}
              description={blog.owner?.bio}
              profileImage={
                blog.owner?.profileImage ||
                blog.thumbnailUrl
              }
              userId={blog.owner?.id}
              isOwner={isBlogOwner}
              followInfo={blog?.followInfo} // 블로그 정보에 포함된 팔로우 정보 사용
            />

            {/* 카테고리별 현황 섹션 */}
            {(() => {
              console.log('🔍 [CATEGORY RENDER CONDITION]', {
                shouldRender: !categoriesLoading && (categories as any[]).length > 0,
                categoriesLoading,
                categoriesLength: (categories as any[]).length,
                categories
              });
              return !categoriesLoading && (categories as any[]).length > 0 && (
                <CategorySection
                  categories={categories as any[]}
                  onCategoryClick={handleCategoryClick}
                />
              );
            })()}

            <RecentPostsSection posts={recentPosts} />

            <TagsSection tags={tags} onTagClick={handleTagClick} />

            <BlogRecommendations />
            </div>
          </aside>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending}
      />
    </div>
  );
}