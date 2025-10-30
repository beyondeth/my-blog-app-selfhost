"use client";

import { useState, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useInfinitePosts, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import InfiniteScrollTrigger from '@/components/posts/InfiniteScrollTrigger';
import { PostSkeletonWithShimmer } from '@/components/posts/PostSkeleton';
import PromoCarouselSection from '@/components/layout/PromoCarouselSection';
import EditorPickSection from '@/components/layout/EditorPickSection';
import PopularPostsSection from '@/components/layout/PopularPostsSection';
import TagsSection from '@/components/layout/TagsSection';
import FollowingListSection from '@/components/FollowingListSection';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useScrollRestoration } from '@/hooks/useInfiniteScroll';

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

  // 커스텀 훅 사용
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfinitePosts({
    search: currentParams.search,
    enabled: true // 홈 페이지는 항상 포스트 로드
  });

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

    // Map을 사용하여 중복 제거 (post.id 기준)
    const postsMap = new Map();
    data.pages.forEach(page => {
      if (page?.posts) {
        page.posts.forEach(post => {
          if (post && post.id) {
            postsMap.set(post.id, post);
          }
        });
      }
    });

    return Array.from(postsMap.values());
  }, [data?.pages]);

  const totalPosts = useMemo(() => {
    return data?.pages[0]?.total || 0;
  }, [data?.pages]);

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
      deletePostMutation.mutate({ postId: deleteDialog.postId }, {
        onSuccess: () => {
          setDeleteDialog({ isOpen: false, postId: null, postTitle: '' });
        },
        onError: () => {
          // 에러 시에도 다이얼로그는 열어둠 (재시도 가능)
        }
      });
    }
  }, [deleteDialog.postId, deletePostMutation]);

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
                  />
                ))}
                
                {/* 무한 스크롤 트리거 */}
                <InfiniteScrollTrigger
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  totalPosts={totalPosts}
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
            {/* 프로모션 캐러셀 섹션 (자동 슬라이드) */}
            <PromoCarouselSection />

            {/* Editor's Pick 섹션 */}
            <EditorPickSection />

            <PopularPostsSection />

            <TagsSection tags={tags} onTagClick={handleTagClick} />

            {user && (
              <FollowingListSection userId={user.id} />
            )}
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
