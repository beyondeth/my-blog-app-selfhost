"use client";

import React, { useState, useCallback, useMemo, Suspense, lazy } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useInfinitePosts, useInfiniteCursorPosts, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useHomepagePosts } from '@/hooks/useHomepagePosts'; // 홈페이지 전용 훅
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import InfiniteScrollTrigger from '@/components/posts/InfiniteScrollTrigger';
import { PostSkeletonWithShimmer } from '@/components/posts/PostSkeleton';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useScrollRestoration } from '@/hooks/useInfiniteScroll';

// 사이드바 컴포넌트 lazy loading (초기 로딩 최적화)
const PromoCarouselSection = lazy(() => import('@/components/layout/PromoCarouselSection'));
const EditorPickSection = lazy(() => import('@/components/layout/EditorPickSection'));
const PopularPostsSection = lazy(() => import('@/components/layout/PopularPostsSection'));
const FollowingListSection = lazy(() => import('@/components/FollowingListSection'));

/**
 * 홈 페이지 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function HomePageContent() {
  // console.log('🏠 [HOME PAGE COMPONENT RENDERED]');

  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getCacheStatus } = useNavigationCache();

  // 스크롤 위치 복원
  useScrollRestoration('home-page');

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
  const currentParams = parseSearchParams(searchParams.toString());

  // 홈페이지 최적화된 훅 사용 (로딩 속도 개선)
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useHomepagePosts({
    search: currentParams.search,
    enabled: true
  });

  // 커서 페이지네이션 사용 (성능 최적화를 위해 항상 활성화)
  const useCursorPagination = true; // 항상 커서 페이지네이션 사용 (대용량 데이터 처리)

  // 디버깅 로그
  // console.log('🔍 [Home Debug] isLoading:', isLoading);
  // console.log('🔍 [Home Debug] hasData:', !!data);
  // console.log('🔍 [Home Debug] pagesCount:', data?.pages?.length);
  // console.log('🔍 [Home Debug] firstPageData:', data?.pages?.[0]);
  // console.log('🔍 [Home Debug] error:', error);
  // console.log('🔍 [Home Debug] search:', currentParams.search);

  const deletePostMutation = useDeletePost();

  // 좋아요 토글 뮤테이션 (postId를 mutate 파라미터로 전달)
  const toggleLikeMutation = useTogglePostLike(() => {
    router.push('/login');
  });

  // 모든 포스트 플래튼 - 메모이제이션 (중복 제거)
  const allPosts = useMemo(() => {
    if (!data?.pages) return [];

    if (useCursorPagination) {
      // 커서 페이지네이션: pages 배열의 posts 직접 합치
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
    } else {
      // Offset 페이지네이션: 기존 로직 유지
      const postsMap = new Map();
      data.pages.forEach((page) => {
        if ((page as { posts?: any[] })?.posts) {
          (page as { posts: any[] }).posts.forEach(post => {
            if (post && post.id) {
              postsMap.set(post.id, post);
            }
          });
        }
      });

      return Array.from(postsMap.values());
    }
  }, [data?.pages, useCursorPagination]);

  const totalPosts = useMemo(() => {
    if (useCursorPagination) {
      // 커서 페이지네이션: hasMore 정보를 기반으로 추정
      // 현재까지 로드된 포스트 수 + 더 불러올 데이터가 있는지 여부
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

      // hasMore가 true면 '+' 표시로 더 많은 데이터가 있음을 알림
      return hasMore ? loadedCount + 1 : loadedCount;
    } else {
      // Offset 페이지네이션: 첫 페이지의 total 값 사용
      return (data?.pages[0] as { total?: number })?.total || 0;
    }
  }, [data?.pages, useCursorPagination]);

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
      // 새 인터페이스 사용 ({ postId } 형태)
      deletePostMutation.mutate({ postId: deleteDialog.postId });
    }
  }, [deleteDialog.postId, deletePostMutation]);

  // 성공 및 에러 처리를 위한 useEffect
  React.useEffect(() => {
    if (deletePostMutation.isSuccess) {
      setDeleteDialog({ isOpen: false, postId: null, postTitle: '' });
    }
  }, [deletePostMutation.isSuccess]);

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

  if (error) {
    return (
      <ErrorMessage 
        message={`오류가 발생했습니다: ${error.message}`}
        showBackButton={false}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 xs:px-3 sm:px-4 pb-4 sm:pb-6 lg:pb-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-8 lg:gap-16">
        {/* Main Content Area - 오른쪽 사이드바를 위한 여백 확보 (right-16[64px] + w-80[320px] + 여유 16px = 400px) */}
        <main className="flex-1 min-w-0 lg:mr-[400px] pt-[70px]">
          <div className="space-y-0">
            {isLoading && allPosts.length === 0 ? (
              // 초기 로딩 시 스켈레톤 UI 표시
              <PostSkeletonWithShimmer count={5} />
            ) : allPosts.length > 0 ? (
              <>
                {allPosts.map((post, index) => (
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
                    searchQuery={currentParams.search}
                    priority={index < 3} // LCP 최적화: 상위 3개 포스트의 프로필 이미지는 즉시 로드
                    isHomeFeed={true}                  />
                ))}
                
                {/* 무한 스크롤 트리거 */}
                <InfiniteScrollTrigger
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  totalPosts={useCursorPagination ? allPosts.length : totalPosts}
                  currentPostsCount={allPosts.length}
                  onLoadMore={loadMorePosts}
                  error={error}
                  onRetry={() => fetchNextPage()}
                />
              </>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <p className="text-sm sm:text-base">아직 포스트가 없습니다.</p>
              </div>
            )}
          </div>
          </main>

          {/* Sidebar - fixed positioning with internal scroll */}
        <aside className="hidden lg:block lg:fixed lg:right-16 lg:top-40 lg:w-80 lg:h-[calc(100vh-8rem)] lg:overflow-y-auto sidebar-scroll">
          <div className="space-y-4 sm:space-y-6">
            {/* 프로모션 캐러셀 섹션 (자동 슬라이드) - Lazy Loading */}
            <Suspense fallback={<div className="h-48 bg-gray-100 animate-pulse rounded-lg" />}>
              <PromoCarouselSection />
            </Suspense>

            {/* Editor's Pick 섹션 - Lazy Loading */}
            <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
              <EditorPickSection />
            </Suspense>

            {/* Popular Posts 섹션 - Lazy Loading */}
            <Suspense fallback={<div className="h-96 bg-gray-100 animate-pulse rounded-lg" />}>
              <PopularPostsSection />
            </Suspense>

            <TagsSection tags={tags} onTagClick={handleTagClick} />

            {/* Following List 섹션 - Lazy Loading */}
            {user && (
              <Suspense fallback={<div className="h-64 bg-gray-100 animate-pulse rounded-lg" />}>
                <FollowingListSection userId={user.id} />
              </Suspense>
            )}

            {/* 사이드바 푸터 */}
            <SidebarFooter />
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

/**
 * 홈 페이지 (Suspense 래퍼)
 */
export default function HomePage() {
  return (
    <Suspense fallback={<PostSkeletonWithShimmer count={5} />}>
      <HomePageContent />
    </Suspense>
  );
}
