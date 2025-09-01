"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useInfinitePosts, useDeletePost } from '@/hooks/usePosts';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import LoadMoreSection from '@/components/posts/LoadMoreSection';
import SearchSection from '@/components/layout/SearchSection';
import RecentPostsSection from '@/components/layout/RecentPostsSection';
import TagsSection from '@/components/layout/TagsSection';
import BlogOwnerCard from '@/components/layout/BlogOwnerCard';
import BlogRecommendations from '@/components/layout/BlogRecommendations';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';

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

// 블로그 정보 타입
interface Blog {
  id: string;
  slug: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  isPublic?: boolean;
  allowComments?: boolean;
  owner?: {
    id: string;
    username: string;
    email: string;
  };
}

export default function BlogPage() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const blogSlug = params.blogSlug as string;
  const isClient = useIsClient();
  const searchParams = useSearchParams();
  const { getCacheStatus } = useNavigationCache();
  
  // 블로그 정보 상태
  const [blog, setBlog] = useState<Blog | null>(null);
  const [blogLoading, setBlogLoading] = useState(true);
  const [blogError, setBlogError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  
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
  const [searchQuery, setSearchQuery] = useState(currentParams.search || '');

  // 블로그 정보 가져오기
  useEffect(() => {
    if (!isClient || !blogSlug) return;

    const fetchBlog = async () => {
      try {
        setBlogLoading(true);
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/blogs/slug/${blogSlug}`, {
          credentials: 'include'
        });
        if (!response.ok) {
          if (response.status === 404) {
            setBlogError('블로그를 찾을 수 없습니다.');
          } else {
            setBlogError('블로그 정보를 불러오는데 실패했습니다.');
          }
          return;
        }
        const data = await response.json();
        setBlog(data);
        
        // 블로그 owner의 상세 프로필 정보 가져오기
        if (data.owner?.id) {
          try {
            const profileResponse = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${data.owner.id}`,
              {
                credentials: 'include'
              }
            );
            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              setUserProfile(profileData);
            }
          } catch (error) {
            console.error('Failed to fetch user profile:', error);
          }
        }
      } catch (error) {
        setBlogError('블로그 정보를 불러오는데 실패했습니다.');
      } finally {
        setBlogLoading(false);
      }
    };

    fetchBlog();
  }, [isClient, blogSlug]);

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

  // 블로그 소유자 여부 확인
  const isBlogOwner = useMemo(() => {
    return blog && user && String(blog.owner?.id) === String(user.id);
  }, [blog, user]);

  // 모든 포스트 플래튼
  const allPosts = useMemo(() => {
    return data?.pages.flatMap(page => page.posts) || [];
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

  // 검색 처리 (URL 업데이트 포함)
  const handleSearch = useCallback((query: string) => {
    const newParams = {
      search: query || undefined,
      page: 1,
    };
    
    const newUrl = `/blog/${blogSlug}${createSearchUrl(newParams)}`;
    router.push(newUrl);
  }, [router, blogSlug]);

  // 검색어 변경 시 URL 파라미터와 동기화
  useEffect(() => {
    if (!isClient) return;
    
    const urlSearch = currentParams.search || '';
    if (searchQuery !== urlSearch) {
      setSearchQuery(urlSearch);
    }
  }, [currentParams.search, isClient]);

  const handleEditPost = useCallback((slug: string) => {
    router.push(`/posts/edit/${slug}`);
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

  if (!isClient) {
    return <LoadingSpinner message="페이지를 불러오는 중..." />;
  }

  if (blogLoading) {
    return <LoadingSpinner message="블로그 정보를 불러오는 중..." />;
  }

  if (blogError) {
    return (
      <ErrorMessage 
        message={blogError}
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
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          {/* Main Content Area */}
          <main className="flex-1 lg:max-w-[calc(100%-380px)] min-w-0">
            <div className="space-y-0">
              {isLoading && allPosts.length === 0 ? (
                <div className="flex justify-center items-center py-12 sm:py-16">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-amber-600"></div>
                  <span className="ml-2 text-sm text-gray-600">게시글을 불러오는 중...</span>
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

          {/* Sidebar */}
          <aside className="w-full lg:w-80 lg:min-w-[320px] space-y-4 sm:space-y-6">
            {/* Blog Owner Card at the top */}
            <BlogOwnerCard
              name={blog.owner?.username || blog.owner?.email || blog.name}
              username={blog.owner?.username}
              description={userProfile?.bio || blog.description}
              profileImage={userProfile?.profileImage || blog.thumbnailUrl}
              userId={blog.owner?.id}
              isOwner={isBlogOwner}
            />
            
            <SearchSection
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onSearch={handleSearch}
            />
            
            <RecentPostsSection posts={recentPosts} />
            
            <TagsSection tags={tags} />
            
            <BlogRecommendations />
          </aside>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={deletePostMutation.isPending}
        itemName={`"${deleteDialog.postTitle}" 게시글`}
        title="게시글을 삭제하시겠습니까?"
        description={`"${deleteDialog.postTitle}" 게시글이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
      />
    </div>
  );
}