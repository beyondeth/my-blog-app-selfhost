"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useInfiniteCursorPosts, useDeletePost, useTogglePostLike } from '@/hooks/usePosts';
import { useBlogBySlug, useBlogCategories } from '@/hooks/useBlogs';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { parseSearchParams } from '@/lib/navigation';
import { useNavigationCache } from '@/hooks/useNavigationCache';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, Clock, Flame } from 'lucide-react'; // Icons added

import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import PostArticle from '@/components/posts/PostArticle';
import RecentPostsSection from '@/components/layout/RecentPostsSection';
import TagsSection from '@/components/layout/TagsSection';
import CategorySection from '@/components/layout/CategorySection';
import BlogOwnerCard from '@/components/layout/BlogOwnerCard';
import BlogRecommendations from '@/components/layout/BlogRecommendations';
import SidebarFooter from '@/components/home/SidebarFooter';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import Spinner from '@/components/ui/Spinner';
import { BlogBrandingHero } from '@/components/blog/BlogBrandingHero';
import { hexToRgb } from '@/lib/color';
import InfiniteScrollTrigger from '@/components/posts/InfiniteScrollTrigger';
import VirtualizedPostItem from '@/components/posts/VirtualizedPostItem';

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

const sortOptions = [
  { value: 'recent', label: '최신순', icon: Clock },
  { value: 'popular', label: '인기순', icon: Flame },
  { value: 'trending', label: 'Top', icon: TrendingUp },
] as const;

type SortType = (typeof sortOptions)[number]['value'];


interface BlogClientPageProps {
  initialBlog: any;
  blogSlug: string;
}

export default function BlogClientPage({ initialBlog, blogSlug }: BlogClientPageProps) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  // const params = useParams(); // params는 props로 전달받음
  // const blogSlug = decodeURIComponent(params.blogSlug as string);

  const isClient = useIsClient();
  const searchParams = useSearchParams();
  const { getCacheStatus } = useNavigationCache();
  
  // 모바일/데스크탑 감지 (사이드바는 lg 이상에서만 표시)
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  // 블로그 정보 가져오기 (React Query 캐싱 사용)
  const {
    data: blog,
    isLoading: blogLoading,
    error: blogError
  } = useBlogBySlug(blogSlug, { initialData: initialBlog });

  // URL 정규화 처리 - 항상 올바른 형태로 리다이렉트
  useEffect(() => {
    if (!blog || !isClient) return;

    const normalizedParams = new URLSearchParams(searchParams.toString());
    // 외부 앱(ChatGPT 등)에서 전달하는 redirectUrl은 블로그 공개 페이지 URL 정규화 시 제거.
    // 공개 URL에 외부 채팅 URL 파라미터가 남지 않도록 한다.
    normalizedParams.delete('redirectUrl');
    const normalizedQueryString = normalizedParams.toString();

    // 1. old_alias 리다이렉트 (기존 로직 유지)
    if (blog && 'shouldRedirect' in blog && blog.shouldRedirect && blog.redirectTo) {
      const redirectPath = `/${blog.redirectTo}${normalizedQueryString ? `?${normalizedQueryString}` : ''}`;
      router.replace(redirectPath);
      return;
    }

    // 2. URL 정규화 - 항상 alias 우선
    if (!('shouldRedirect' in blog) || !blog.shouldRedirect) {
      const queryString = normalizedQueryString;
      const currentPathWithQuery = `${window.location.pathname}${window.location.search || ''}`;

      // alias가 있는 경우 /@alias로, 없는 경우 /slug로 이동
      if (blog.alias) {
        const correctPath = `/@${blog.alias}${queryString ? `?${queryString}` : ''}`;
        // 현재 URL과 정규화된 URL이 다른 경우에만 리다이렉트
        if (currentPathWithQuery !== correctPath) {
          router.replace(correctPath);
        }
      } else {
        const correctPath = `/${blog.slug}${queryString ? `?${queryString}` : ''}`;
        // 현재 URL과 정규화된 URL이 다른 경우에만 리다이렉트
        if (currentPathWithQuery !== correctPath) {
          router.replace(correctPath);
        }
      }
    }
  }, [blog, searchParams, router, isClient]);

  // 블로그의 카테고리별 포스트 개수 가져오기 (데스크탑에서만)
  // 모바일에서는 사이드바가 숨겨져 있으므로 불필요한 API 호출 방지
  const {
    data: categoryPagesData,
    isLoading: categoriesLoading,
    error: categoriesError,
    fetchNextPage: fetchNextCategories,
    hasNextPage: hasMoreCategories,
    isFetchingNextPage: isFetchingNextCategories,
  } = useBlogCategories(blogSlug, { enabled: isClient && isDesktop });

  const flattenedCategories = useMemo(() => {
    if (!categoryPagesData?.pages) return [];
    return categoryPagesData.pages.flatMap(page => page.items);
  }, [categoryPagesData?.pages]);

  const totalCategoriesCount = useMemo(() => {
    return categoryPagesData?.pages?.[0]?.total ?? 0;
  }, [categoryPagesData?.pages]);

  // 디버그 로그
  console.log('🔍 [CATEGORIES DEBUG]', {
    blogSlug,
    categoriesLoading,
    categoriesLength: flattenedCategories.length,
    totalCategoriesCount,
    hasMoreCategories,
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

  const [sortBy, setSortBy] = useState<SortType>('recent');

  // URL에서 검색 파라미터 파싱
  const currentParams = isClient ? parseSearchParams(searchParams.toString()) : { page: 1 };
  const currentTag = isClient ? (searchParams.get('tag') || undefined) : undefined;

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
    tag: currentTag,
    blogId: blog?.id, // blogId를 직접 전달하여 정확한 필터링

    sort: sortBy,
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

  const hasCategoryFilter = Boolean(currentParams.category);
  const hasTagFilter = Boolean(currentTag);
  const emptyStateMessage = hasTagFilter
    ? "이 태그의 글이 삭제되었거나 아직 발행되지 않아 표시할 내용이 없습니다."
    : hasCategoryFilter
    ? "이 카테고리의 글이 삭제되었거나 아직 발행되지 않아 표시할 내용이 없습니다."
    : isBlogOwner
      ? "아직 작성된 글이 없습니다. 첫 번째 글을 작성해보세요."
      : "아직 포스트가 없습니다.";

  // 브랜드 색상 관련 유틸
  const brandColor = useMemo(() => {
    if (blog?.brandColor && /^#[0-9A-Fa-f]{6}$/.test(blog.brandColor)) {
      return blog.brandColor.toUpperCase();
    }
    return null;
  }, [blog?.brandColor]);

  const brandRgb = useMemo(() => {
    if (!brandColor) return null;
    const rgb = hexToRgb(brandColor);
    return rgb ? `${rgb[0]}, ${rgb[1]}, ${rgb[2]}` : null;
  }, [brandColor]);

  const pageBrandingStyles = useMemo(() => {
    if (!brandColor || !brandRgb) {
      return undefined;
    }
    return {
      '--blog-brand-color': brandColor,
      '--blog-brand-color-rgb': brandRgb,
    } as CSSProperties;
  }, [brandColor, brandRgb]);

  useEffect(() => {
    if (!isClient || !blog) return;

    const existingThemeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    const previousThemeColor = existingThemeMeta?.getAttribute('content') ?? null;
    let createdThemeMeta: HTMLMetaElement | null = null;

    const appliedThemeColor = Boolean(brandColor);

    if (brandColor) {
      if (existingThemeMeta) {
        existingThemeMeta.setAttribute('content', brandColor);
      } else {
        createdThemeMeta = document.createElement('meta');
        createdThemeMeta.setAttribute('name', 'theme-color');
        createdThemeMeta.setAttribute('content', brandColor);
        document.head.appendChild(createdThemeMeta);
      }
    }

    const updateLink = (rel: string) => {
      const existing = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      const previousHref = existing?.getAttribute('href') ?? null;

      if (!blog.iconUrl) {
        return { created: null as HTMLLinkElement | null, element: existing, previousHref };
      }

      if (existing) {
        existing.setAttribute('href', blog.iconUrl);
        return { created: null as HTMLLinkElement | null, element: existing, previousHref };
      }

      const link = document.createElement('link');
      link.setAttribute('rel', rel);
      link.setAttribute('href', blog.iconUrl);
      document.head.appendChild(link);
      return { created: link, element: link, previousHref: null as string | null };
    };

    const faviconInfo = blog.iconUrl ? updateLink('icon') : null;
    const appleIconInfo = blog.iconUrl ? updateLink('apple-touch-icon') : null;

    return () => {
      if (appliedThemeColor) {
        if (existingThemeMeta && previousThemeColor !== null) {
          existingThemeMeta.setAttribute('content', previousThemeColor);
        } else if (existingThemeMeta && previousThemeColor === null) {
          existingThemeMeta.removeAttribute('content');
        }

        if (createdThemeMeta) {
          createdThemeMeta.remove();
        }
      }

      const revertLink = (info: { created: HTMLLinkElement | null; element: HTMLLinkElement | null; previousHref: string | null } | null) => {
        if (!info) return;

        if (info.created) {
          info.created.remove();
          return;
        }

        if (info.element) {
          if (info.previousHref !== null) {
            info.element.setAttribute('href', info.previousHref);
          } else {
            info.element.removeAttribute('href');
          }
        }
      };

      if (blog.iconUrl) {
        revertLink(faviconInfo);
        revertLink(appleIconInfo);
      }
    };
  }, [isClient, blog, brandColor]);

  // 모든 포스트 플래튼 (커서 페이지네이션용)
  const allPosts = useMemo(() => {
    if (!data?.pages) return [];

    // 조기 종료: 빈 데이터에 대한 불필요한 Map 연산 제거
    const firstPage = data.pages[0];
    if (!firstPage?.posts || firstPage.posts.length === 0) return [];

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

  const hasAnyPosts = allPosts.length > 0;
  const pendingCursorRef = useRef<string | null>(null);
  const lastCursor = data?.pages?.[data.pages.length - 1]?.nextCursor ?? null;

  const loadMorePosts = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    const cursorToUse = lastCursor ?? '__INITIAL__';
    if (pendingCursorRef.current === cursorToUse) {
      return;
    }
    pendingCursorRef.current = cursorToUse;
    fetchNextPage().finally(() => {
      pendingCursorRef.current = null;
    });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, lastCursor]);

  // 최근 포스트 (처음 5개) - 데스크탑에서만 계산
  const recentPosts = useMemo(() => {
    if (!isDesktop) return []; // 모바일에서는 계산 스킵
    if (allPosts.length === 0) return []; // 조기 종료
    return allPosts.slice(0, 5);
  }, [allPosts, isDesktop]);

  // 실제 포스트에서 태그 추출 - 메모이제이션 (데스크탑에서만)
  const tags = useMemo(() => {
    if (!isDesktop) return []; // 모바일에서는 계산 스킵
    if (allPosts.length === 0) return []; // 조기 종료: 빈 배열 루프 제거

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
  }, [allPosts, isDesktop]);

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
    // 블로그 내부 tag 필터를 사용하고, 충돌 가능성이 있는 search/category는 제거
    const params = new URLSearchParams(searchParams.toString());
    params.set('tag', tag);
    params.set('page', '1');
    params.delete('search');
    params.delete('category');
    router.push(`/${blogSlug}?${params.toString()}`);
  }, [router, blogSlug, searchParams]);

  // 카테고리 클릭 처리 (블로그 내 카테고리 필터링)
  const handleCategoryClick = useCallback((category: string) => {
    // 블로그 내부 category 필터를 사용하고, 충돌 가능성이 있는 search/tag는 제거
    const params = new URLSearchParams(searchParams.toString());
    params.set('category', category);
    params.set('page', '1');
    params.delete('search');
    params.delete('tag');

    router.push(`/${blogSlug}?${params.toString()}`);
  }, [router, blogSlug, searchParams]);

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
    <div
      className="w-full bg-white text-[#1B2430] dark:bg-[#0E141B] dark:text-[#E6EDF3]"
      style={pageBrandingStyles}
    >
      <div className="max-w-7xl mx-auto px-6 pb-16 pt-20">
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          {/* Main Content Area */}
          <main className="flex-1 min-w-0 pt-0">
            <div className="space-y-8">
              <div className="max-w-[780px] mx-auto">
                <BlogBrandingHero
                  blog={blog}
                  brandColor={brandColor}
                  isOwner={isBlogOwner}
                />
              </div>

              <div className="max-w-[780px] mx-auto flex flex-wrap gap-2">
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = sortBy === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 ${
                        isActive
                          ? 'bg-gray-900 text-white border border-gray-900 dark:bg-gray-700 dark:text-gray-100 dark:border-gray-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                      }`}
                      style={isActive && brandColor ? {
                        backgroundColor: brandColor,
                        borderColor: brandColor,
                        color: '#fff' 
                      } : undefined}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="max-w-[780px] mx-auto space-y-3 sm:space-y-4">
                {isLoading && !hasAnyPosts ? (
                  <div className="flex justify-center items-center py-12 sm:py-16">
                    <Spinner size="lg" />
                  </div>
                ) : hasAnyPosts ? (
                  <>
                    {allPosts.map((post, index) => (
                      <VirtualizedPostItem
                        key={post.id}
                        initialVisible={index < 5}
                      >
                        <PostArticle
                          post={post}
                          isAdmin={isAdmin}
                          isAuthenticated={isAuthenticated}
                          userId={user?.id}
                          onEdit={handleEditPost}
                          onDelete={handleDeletePost}
                          onLike={handleLikePost}
                          isDeleting={deletePostMutation.isPending && deleteDialog.postId === post.id}
                        />
                      </VirtualizedPostItem>
                    ))}

                    <InfiniteScrollTrigger
                      hasNextPage={!!hasNextPage}
                      isFetchingNextPage={isFetchingNextPage}
                      totalPosts={allPosts.length}
                      currentPostsCount={allPosts.length}
                      onLoadMore={loadMorePosts}
                      error={error ?? null}
                      onRetry={loadMorePosts}
                    />
                  </>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <p className="text-sm sm:text-base">
                      {emptyStateMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </main>

          {/* Sidebar - sticky positioning */}
          <aside className="hidden lg:block lg:sticky lg:top-28 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto sidebar-scroll bg-white dark:bg-[#0E141B]">
            <div className="space-y-4 sm:space-y-6">
              {/* Blog Owner Card at the top */}
              <BlogOwnerCard
                name={blog.owner?.name || blog.owner?.username || blog.name}
                username={blog.owner?.username}
                jobTitle={blog.owner?.jobTitle || undefined}
                description={blog.owner?.bio}
                profileImage={blog.owner?.profileImage || null}
                userId={blog.owner?.id}
                isOwner={isBlogOwner}
                followInfo={blog?.followInfo} // 블로그 정보에 포함된 팔로우 정보 사용
                socialLinks={blog.owner?.socialLinks}
                brandImage={
                  blog.logoUrl ||
                  blog.coverImageUrl ||
                  blog.iconUrl ||
                  blog.thumbnailUrl ||
                  null
                }
                brandColor={brandColor ?? undefined}
                className="mb-6"
              />

              {/* 카테고리별 현황 섹션 */}
              {(() => {
                console.log('🔍 [CATEGORY RENDER CONDITION]', {
                  shouldRender: !categoriesLoading && flattenedCategories.length > 0,
                  categoriesLoading,
                  categoriesLength: flattenedCategories.length,
                  totalCategoriesCount,
                  hasMoreCategories,
                });
                return !categoriesLoading && flattenedCategories.length > 0 && (
                  <CategorySection
                    categories={flattenedCategories as any[]}
                    onCategoryClick={handleCategoryClick}
                    hasMore={!!hasMoreCategories}
                    onLoadMore={hasMoreCategories ? () => fetchNextCategories() : undefined}
                    isLoadingMore={isFetchingNextCategories}
                    className="bg-white"
                  />
                );
              })()}

              <RecentPostsSection posts={recentPosts} className="bg-white" />

              <TagsSection
                tags={tags}
                onTagClick={handleTagClick}
                className="bg-white"
              />

              <BlogRecommendations className="bg-white" />
              <SidebarFooter />
            </div>
          </aside>
        </div>
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
