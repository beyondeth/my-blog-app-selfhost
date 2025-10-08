"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useInfinitePosts, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useBlogBySlug } from '@/hooks/useBlogs';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';
import { toast } from 'sonner';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import LoadMoreSection from '@/components/posts/LoadMoreSection';
import RecentPostsSection from '@/components/layout/RecentPostsSection';
import TagsSection from '@/components/layout/TagsSection';
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
  const blogSlug = params.blogSlug as string;
  console.log('📝 [BLOG PAGE COMPONENT RENDERED] blogSlug:', blogSlug);

  const isClient = useIsClient();
  const searchParams = useSearchParams();
  const { getCacheStatus } = useNavigationCache();

  // 블로그 정보 가져오기 (React Query 캐싱 사용)
  const {
    data: blog,
    isLoading: blogLoading,
    error: blogError
  } = useBlogBySlug(blogSlug);

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

  // 블로그의 포스트 가져오기
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfinitePosts({ 
    search: currentParams.search,
    blogSlug: blogSlug, // 블로그별 포스트 필터링
    enabled: isClient && !!blog
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

  // 모든 포스트 플래튼
  const allPosts = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(page => page?.posts || []).filter(post => post);
  }, [data?.pages]);

  const totalPosts = useMemo(() => {
    return data?.pages[0]?.total || 0;
  }, [data?.pages]);

  // 최근 포스트 (처음 5개)
  const recentPosts = useMemo(() => {
    return allPosts.slice(0, 5);
  }, [allPosts]);

  // 태그 추출
  const tags = useMemo(() => {
    return ['JavaScript', 'React', 'Node.js', 'TypeScript', 'Next.js'];
  }, []);

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
      deletePostMutation.mutate(deleteDialog.postId, {
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
                    totalPosts={totalPosts}
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
              description={blog.owner?.bio || blog.description}
              profileImage={blog.owner?.profileImage || blog.thumbnailUrl}
              userId={blog.owner?.id}
              isOwner={isBlogOwner}
            />
            
            <RecentPostsSection posts={recentPosts} />
            
            <TagsSection tags={tags} />
            
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