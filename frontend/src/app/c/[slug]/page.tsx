'use client';

import React, { use, useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notFound } from 'next/navigation';
import { TrendingUp, Clock, Flame } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCommunity, useCommunityWidgets } from '@/hooks/community';
import { useManageCommunityWidgets } from '@/hooks/community/useCommunityWidgets';
import { useCommunityPosts, useCommunityPostVote, useDeleteCommunityPost } from '@/hooks/community/useCommunityPosts';
import { useAdultVerificationStatus } from '@/hooks/adult-verification/useAdultVerification';
import CommunityHeader from '@/components/community/CommunityHeader';
import CommunitySidebar from '@/components/community/CommunitySidebar';
import NsfwBlockedOverlay from '@/components/community/NsfwBlockedOverlay';
import AdultVerificationModal from '@/components/adult-verification/AdultVerificationModal';
import { Button } from '@/components/ui/button';
import PostArticle from '@/components/posts/PostArticle';
import type { Post } from '@/types';
import { AuthProvider, UserRole } from '@/types';
import type { CommunityPost, CommunityPostSortByType } from '@/types/community';
import { isModeratorOrAbove } from '@/types/community';
import { WidgetEditorProvider } from '@/components/community/context/WidgetEditorContext';
import WidgetEditorPanel from '@/components/community/widgets/WidgetEditorPanel';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import InfiniteScrollTrigger from '@/components/posts/InfiniteScrollTrigger';
import VirtualizedPostItem from '@/components/posts/VirtualizedPostItem';

interface CommunityDetailPageProps {
  params: Promise<{ slug: string }>;
}

const IMAGE_SRC_REGEX = /<img[^>]+src=["']([^"']+)["']/gi;

const extractImageUrls = (html?: string | null): string[] => {
  if (!html) return [];
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = IMAGE_SRC_REGEX.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return Array.from(new Set(urls));
};

const stripHtml = (html?: string | null): string => {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
};

const createPlaceholderAuthor = (post: CommunityPost): Post['author'] => {
  const username = post.author?.username || '알 수 없음';
  const id = post.author?.id || `community-${post.id}`;

  return {
    id,
    email: `${id}@community.local`,
    username,
    profileImage: post.author?.profileImage,
    role: UserRole.USER,
    authProvider: AuthProvider.LOCAL,
    isEmailVerified: true,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
};

const adaptCommunityPostToFeedPost = (post: CommunityPost): Post => {
  const rawContent = post.content || '';
  const inlineImages = extractImageUrls(rawContent);
  const explicitThumbnail = post.thumbnailImageUrl || post.thumbnailUrl || undefined;
  const imageSet = new Set<string>();
  inlineImages.forEach((url) => url && imageSet.add(url));
  if (explicitThumbnail) {
    imageSet.add(explicitThumbnail);
  }
  const images = imageSet.size > 0 ? Array.from(imageSet) : undefined;
  const thumbnail = explicitThumbnail || images?.[0] || undefined;
  const excerpt = stripHtml(post.excerpt || post.contentPreview || rawContent);

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    content: rawContent,
    excerpt,
    thumbnail,
    images,
    thumbnailImageId: post.thumbnailImageId,
    isPublished: post.status === 'published',
    status: post.status,
    isDeleted: post.status === 'removed',
    viewCount: post.viewCount,
    likeCount: post.likeCount,
    upvoteCount: post.upvoteCount,
    downvoteCount: post.downvoteCount,
    score: post.score,
    commentCount: post.commentCount,
    liked: post.userLiked ?? false,
    userVote: post.userVote,
    tags: post.tags,
    category: '',
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    publishedAt: post.createdAt,
    author: createPlaceholderAuthor(post),
    blogId: post.communityId,
    blog: undefined,
    comments: [],
    likedBy: [],
    attachedFiles: [],
    qualityScore: null,
    isEditorPick: false,
  };
};

/**
 * 커뮤니티 상세 페이지 (/community/[slug])
 * - 커뮤니티 헤더
 * - 게시물 피드 (무한 스크롤)
 * - 사이드바 (커뮤니티 정보, 규칙)
 */
export default function CommunityDetailPage({ params }: CommunityDetailPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user, isAdmin } = useAuth();
  const searchQuery = searchParams.get('search')?.trim() || '';

  const [sortBy, setSortBy] = useState<CommunityPostSortByType>('newest');

  // NSFW 성인 인증 관련 상태
  const { isAdultVerified, isLoading: isAdultVerificationLoading } = useAdultVerificationStatus();
  const [showAdultModal, setShowAdultModal] = useState(false);
  const loginRedirectUrl = useMemo(() => `/login?redirect=${encodeURIComponent(`/c/${slug}`)}`, [slug]);

  // 커뮤니티 정보 조회
  const {
    data: community,
    isLoading: isCommunityLoading,
    isError: isCommunityError,
    error: communityError,
  } = useCommunity(slug);
  const canEditWidgets = community ? isModeratorOrAbove(community.userMembership?.role) : false;
  const { data: publicWidgets = [] } = useCommunityWidgets(slug);
  const { data: manageWidgets = [] } = useManageCommunityWidgets(slug, { enabled: canEditWidgets });
  const editorWidgets = canEditWidgets && manageWidgets.length > 0 ? manageWidgets : publicWidgets;

  // 게시물 목록 조회 (무한 스크롤)
  const {
    data: postsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isPostsLoading,
    isError: isPostsError,
    error: postsError,
  } = useCommunityPosts(slug, {
    sortBy,
    limit: 20,
    search: searchQuery || undefined,
  });

  // 투표 mutation
  const voteMutation = useCommunityPostVote(slug);

  const allPosts = useMemo(() => {
    if (!postsData?.pages) return [];
    return postsData.pages.flatMap((page) => page.items || []);
  }, [postsData?.pages]);

  const pinnedPosts = useMemo(() => {
    if (!postsData?.pages?.length) return [];
    return postsData.pages[0]?.pinnedPosts ?? [];
  }, [postsData?.pages]);

  const regularPosts = useMemo(() => allPosts, [allPosts]);
  const totalPostCount = regularPosts.length + pinnedPosts.length;
  const pendingCursorRef = useRef<string | null>(null);
  const lastCursor = postsData?.pages?.[postsData.pages.length - 1]?.nextCursor ?? null;

  const requestNextPage = useCallback(() => {
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
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, lastCursor]);

  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; target?: CommunityPost | null }>({
    isOpen: false,
  });
  const {
    mutate: deleteCommunityPost,
    isPending: isDeletePending,
  } = useDeleteCommunityPost(slug);
  const findPostById = useCallback(
    (postId: string): CommunityPost | undefined => {
      return (
        pinnedPosts.find((post) => post.id === postId) ||
        regularPosts.find((post) => post.id === postId)
      );
    },
    [pinnedPosts, regularPosts],
  );

  const handleEditPost = useCallback(
    (postId: string) => {
      const target = findPostById(postId);
      if (!target) return;
      router.push(`/c/${slug}/comments/${target.slug}/edit`);
    },
    [findPostById, router, slug],
  );

  const handleDeletePost = useCallback(
    (postId: string) => {
      const target = findPostById(postId);
      if (!target) return;
      setDeleteDialog({ isOpen: true, target });
    },
    [findPostById],
  );

  const handleCloseDeleteDialog = useCallback(() => {
    if (isDeletePending) return;
    setDeleteDialog({ isOpen: false });
  }, [isDeletePending]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteDialog.target) return;
    deleteCommunityPost(
      { postId: deleteDialog.target.id, postSlug: deleteDialog.target.slug },
      {
        onSuccess: () => setDeleteDialog({ isOpen: false }),
      },
    );
  }, [deleteDialog.target, deleteCommunityPost]);

  // 투표 클릭 핸들러
  const handleVote = useCallback((postId: string, voteType: 'upvote' | 'downvote') => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const post = findPostById(postId);
    if (!post) return;
    voteMutation.mutate({ postId, postSlug: post.slug, voteType });
  }, [findPostById, isAuthenticated, router, voteMutation]);

  // NSFW 커뮤니티 접근 시 성인 인증 체크
  useEffect(() => {
    // 커뮤니티 로딩 완료 && NSFW 커뮤니티 && 인증 로딩 완료 && 미인증 상태
    if (community && community.isNsfw && !isAdultVerificationLoading && !isAdultVerified) {
      setShowAdultModal(true);
    }
  }, [community, isAdultVerified, isAdultVerificationLoading]);


  // NSFW 성인 인증 완료 핸들러
  const handleAdultVerified = useCallback(() => {
    setShowAdultModal(false);
  }, []);

  // NSFW 모달 닫기 (뒤로가기) 핸들러
  const handleNsfwModalClose = useCallback(() => {
    setShowAdultModal(false);
    router.back();
  }, [router]);

  // NSFW 인증하기 버튼 클릭 핸들러
  const handleVerifyClick = useCallback(() => {
    setShowAdultModal(true);
  }, []);

  // 로그인으로 이동
  const handleLoginRedirect = useCallback(() => {
    router.push(loginRedirectUrl);
  }, [router, loginRedirectUrl]);

  // 정렬 옵션
  const sortOptions = [
    { value: 'newest' as const, label: '최신순', icon: Clock },
    { value: 'hot' as const, label: '인기순', icon: Flame },
    { value: 'top' as const, label: 'TOP', icon: TrendingUp },
  ];

  // 로딩 상태
  if (isCommunityLoading) {
    return (
      <div className="animate-pulse">
        {/* 배너 스켈레톤 */}
        <div className="h-48 bg-gray-200 dark:bg-gray-800" />
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="flex gap-8">
            <div className="flex-1 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 dark:bg-gray-800 rounded-xl" />
              ))}
            </div>
            <div className="hidden lg:block w-80">
              <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (isCommunityError) {
    const isPrivateAccessError =
      communityError instanceof Error &&
      (((communityError as Error & { status?: number }).status ?? 0) === 403 ||
        communityError.message.includes('초대 전용'));

    if (isPrivateAccessError) {
      return (
        <div className="max-w-6xl mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            초대 전용 커뮤니티입니다
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            멤버만 접근할 수 있습니다. 초대 링크가 필요합니다.
          </p>
          <div className="flex items-center justify-center gap-3">
            {!isAuthenticated && (
              <Button onClick={handleLoginRedirect}>로그인</Button>
            )}
            <Button variant="outline" onClick={() => router.back()}>
              뒤로 가기
            </Button>
          </div>
        </div>
      );
    }

    if (communityError instanceof Error && communityError.message.includes('404')) {
      notFound();
    }
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          커뮤니티를 불러올 수 없습니다
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          {communityError instanceof Error ? communityError.message : '알 수 없는 오류가 발생했습니다.'}
        </p>
        <Button onClick={() => router.back()}>뒤로 가기</Button>
      </div>
    );
  }

  if (!community) {
    return notFound();
  }

  // NSFW 커뮤니티 접근 차단 (미인증 상태)
  // 인증 로딩 중에는 표시하지 않음 (깜빡임 방지)
  if (community.isNsfw && !isAdultVerificationLoading && !isAdultVerified) {
    if (!isAuthenticated) {
      return (
        <>
          <NsfwBlockedOverlay
            communityName={community.name}
            onBack={() => router.back()}
            requiresLogin
            onLogin={handleLoginRedirect}
          />
          <AdultVerificationModal
            isOpen={showAdultModal}
            onClose={handleNsfwModalClose}
            title="로그인이 필요합니다"
            description={`"${community.name}" 커뮤니티는 성인 전용입니다.`}
            requiresLogin
            onLogin={handleLoginRedirect}
            loginDescription="로그인을 완료하면 성인 인증을 진행하여 NSFW 커뮤니티를 안전하게 이용할 수 있습니다."
          />
        </>
      );
    }

    return (
      <>
        <NsfwBlockedOverlay
          communityName={community.name}
          onVerify={handleVerifyClick}
          onBack={() => router.back()}
        />
        <AdultVerificationModal
          isOpen={showAdultModal}
          onClose={handleNsfwModalClose}
          onVerified={handleAdultVerified}
          title="성인 인증 필요"
          description={`"${community.name}" 커뮤니티는 성인 전용입니다. 계속하려면 성인 인증이 필요합니다.`}
        />
      </>
    );
  }

  return (
    <WidgetEditorProvider community={community}>
      <div className="min-h-screen w-full bg-white text-[#1B2430] dark:bg-[#0E141B] dark:text-[#E6EDF3]">
        <div className="max-w-7xl mx-auto px-6 pb-16 pt-16">
          <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
          <div className="lg:col-span-2">
            <CommunityHeader community={community} />
          </div>

          {/* 피드 영역 */}
          <main className="flex-1 min-w-0 pt-0">
            {/* 정렬 탭 */}
            <div className="mb-4">
              <div className="max-w-[780px] mx-auto flex items-center justify-start gap-2">
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = sortBy === option.value;

                  return (
                    <button
                      key={option.value}
                      onClick={() => setSortBy(option.value)}
                      className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors duration-200 border ${
                        isActive
                          ? 'bg-[#264653] text-[#F9FBFD] border-[#264653] dark:bg-[#6CC3B2] dark:text-[#0E141B] dark:border-[#6CC3B2]'
                          : 'bg-[#F7F9FC] text-[#4B5563] border-[#D9E0EA] hover:bg-[#EEF3F8] dark:bg-[#131A22] dark:text-[#A9B4C2] dark:border-[#2A3645] dark:hover:bg-[#1A232E]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 고정 게시물 */}
            {pinnedPosts.length > 0 && (
              <div className="mb-6 max-w-[780px] mx-auto space-y-3">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  고정된 게시물
                </h3>
                {pinnedPosts.map((post, index) => {
                  const feedPost = adaptCommunityPostToFeedPost(post);
                  return (
                    <VirtualizedPostItem
                      key={post.id}
                      initialVisible={index < 2}
                    >
                      <PostArticle
                        post={feedPost}
                        isAdmin={isAdmin}
                        isAuthenticated={isAuthenticated}
                        userId={user?.id}
                        onEdit={handleEditPost}
                        onDelete={handleDeletePost}
                        onVote={handleVote}
                        votePending={voteMutation.isPending}
                        isHomeFeed
                        priority={index < 2}
                        postUrlOverride={`/c/${slug}/comments/${post.slug}`}
                        showCommunityHeader={false}
                        showAuthorPrefix={false}
                        communityContext={{
                          slug,
                          name: community?.name,
                          flair: post.flair,
                          isPinned: post.isPinned,
                          isLocked: post.isLocked,
                          isNsfw: post.isNsfw,
                          isSpoiler: post.isSpoiler,
                          shouldBlurMedia: post.isNsfw && !isAdultVerified,
                        }}
                      />
                    </VirtualizedPostItem>
                  );
                })}
              </div>
            )}

            {/* 일반 게시물 */}
            {isPostsLoading ? (
              <div className="max-w-[780px] mx-auto space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="h-6 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mb-3" />
                    <div className="space-y-2">
                      <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : regularPosts.length === 0 && pinnedPosts.length === 0 ? (
              <div className="max-w-[780px] mx-auto text-center py-12 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  아직 게시물이 없습니다.
                </p>
                {community.userMembership?.isMember && (
                  <Button onClick={() => router.push(`/c/${slug}/submit`)}>
                    첫 번째 게시물 작성하기
                  </Button>
                )}
              </div>
            ) : (
              <div className="max-w-[780px] mx-auto space-y-3">
                {regularPosts.map((post, index) => {
                  const feedPost = adaptCommunityPostToFeedPost(post);
                  return (
                    <VirtualizedPostItem
                      key={post.id}
                      initialVisible={index < 5}
                    >
                      <PostArticle
                        post={feedPost}
                        isAdmin={isAdmin}
                        isAuthenticated={isAuthenticated}
                        userId={user?.id}
                        onEdit={handleEditPost}
                        onDelete={handleDeletePost}
                        onVote={handleVote}
                        votePending={voteMutation.isPending}
                        isHomeFeed
                        priority={index < 3}
                        postUrlOverride={`/c/${slug}/comments/${post.slug}`}
                        showCommunityHeader={false}
                        showAuthorPrefix={false}
                        communityContext={{
                          slug,
                          name: community?.name,
                          flair: post.flair,
                          isPinned: post.isPinned,
                          isLocked: post.isLocked,
                          isNsfw: post.isNsfw,
                          isSpoiler: post.isSpoiler,
                          shouldBlurMedia: post.isNsfw && !isAdultVerified,
                        }}
                      />
                    </VirtualizedPostItem>
                  );
                })}
              </div>
            )}

            {totalPostCount > 0 && (
              <div className="mt-8">
                <InfiniteScrollTrigger
                  hasNextPage={!!hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  totalPosts={totalPostCount}
                  currentPostsCount={totalPostCount}
                  onLoadMore={requestNextPage}
                  error={postsError ?? null}
                  onRetry={requestNextPage}
                />
              </div>
            )}
          </main>

          {/* 사이드바 (데스크톱) */}
          <aside className="hidden lg:block lg:sticky lg:top-28 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto sidebar-scroll bg-white dark:bg-[#0E141B]">
            <div className="space-y-4 sm:space-y-6 lg:pt-[56px]">
              <CommunitySidebar
                community={community}
                showJoinButton={isAuthenticated}
                widgets={publicWidgets}
                canEditWidgets={canEditWidgets}
              />
            </div>
          </aside>
          </div>

        <DeleteConfirmDialog
          isOpen={deleteDialog.isOpen}
          onClose={handleCloseDeleteDialog}
          onConfirm={handleConfirmDelete}
          isLoading={isDeletePending}
          title={deleteDialog.target?.title}
        />
        </div>
      </div>
      {canEditWidgets && <WidgetEditorPanel widgets={editorWidgets} />}
    </WidgetEditorProvider>
  );
}
