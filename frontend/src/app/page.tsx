"use client";

import React, { useState, useCallback, useMemo, Suspense, lazy, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useVote } from '@/hooks/useVote';
import { useUnifiedFeed } from '@/hooks/feed';
import { communityService } from '@/services/api/community.service';
import type { UnifiedFeedItem as FeedItemType, UnifiedFeedResponse, FeedSortType, FeedSourceType } from '@/services/api/feed.service';
import PostArticle from '@/components/posts/PostArticle';
import type { VoteResponse, VoteType } from '@/types';
import { useAdultVerificationStatus } from '@/hooks/adult-verification/useAdultVerification';
import { adaptUnifiedFeedItem } from '@/utils/feed/unifiedFeedAdapter';
import { TrendingUp, Clock, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEditorPicks } from '@/hooks/useEditorPicks';
import { shouldDisableOptimization } from '@/utils/imageUtils';
import { Avatar } from '@/components/ui/avatar';

import ErrorMessage from '@/components/ui/ErrorMessage';
import InfiniteScrollTrigger from '@/components/posts/InfiniteScrollTrigger';
import { PostSkeletonWithShimmer } from '@/components/posts/PostSkeleton';
import VirtualizedPostItem from '@/components/posts/VirtualizedPostItem';
import { useScrollRestoration } from '@/hooks/useInfiniteScroll';
import SidebarFooter from '@/components/home/SidebarFooter';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { useDeletePost } from '@/hooks/usePosts';
import { feedQueryKeys } from '@/hooks/feed/useUnifiedFeed';

// 사이드바 컴포넌트 lazy loading (초기 로딩 최적화)
const PromoCarouselSection = lazy(() => import('@/components/layout/PromoCarouselSection'));
const PopularPostsSection = lazy(() => import('@/components/layout/PopularPostsSection'));
const ConnectionsSection = lazy(() => import('@/components/ConnectionsSection'));
const TrendingCommunityPostsSection = lazy(() => import('@/components/layout/TrendingCommunityPostsSection'));
const MyCommunitiesSection = lazy(() => import('@/components/layout/MyCommunitiesSection'));
import SidebarCtaSection from '@/components/layout/SidebarCtaSection';

/**
 * 홈 페이지 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
const sortOptions: Array<{ value: FeedSortType; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'recent', label: '최신순', icon: Clock },
  { value: 'hot', label: '인기순', icon: Flame },
  { value: 'top', label: 'Top', icon: TrendingUp },
];



const HomeFeedPlaceholderCard = ({ hasImage = true }: { hasImage?: boolean }) => (
  <div className="h-full animate-pulse rounded-3xl border border-[#D9E0EA] bg-white p-5 sm:p-6 shadow-sm dark:border-[#4B5563] dark:bg-[#131A22]">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-full bg-[#EEF3F8] dark:bg-[#1A232E]" />
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
        <div className="h-3 w-16 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
      </div>
    </div>
    <div className="mt-5 space-y-3">
      <div className="h-4 w-3/4 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
      <div className="h-4 w-2/3 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
    </div>
    <div className="mt-4 space-y-2">
      <div className="h-3 w-full rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
      <div className="h-3 w-5/6 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
      <div className="h-3 w-2/3 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
    </div>
    {hasImage && (
      <div className="mt-5 h-40 w-full rounded-2xl bg-[#EEF3F8] dark:bg-[#1A232E]" />
    )}
    <div className="mt-6 flex items-center gap-4">
      <div className="h-4 w-16 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
      <div className="h-4 w-20 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
      <div className="h-4 w-16 rounded bg-[#EEF3F8] dark:bg-[#1A232E]" />
    </div>
  </div>
);

function HomePageContent() {
  // console.log('🏠 [HOME PAGE COMPONENT RENDERED]');

  const { user, isAuthenticated, isAdmin } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<FeedSortType>('recent');
  const feedQueryKey = useMemo(() => ['unified-feed', 'all', sortBy, 20] as const, [sortBy]);
  const { isAdultVerified } = useAdultVerificationStatus();
  const { data: editorPickData, isLoading: isEditorPicksLoading } = useEditorPicks(5);
  const editorPickPosts = editorPickData?.posts ?? [];
  const [activePickIndex, setActivePickIndex] = useState(0);
  const activePick = editorPickPosts[activePickIndex];
  const activePickImage = activePick?.thumbnail || activePick?.images?.[0] || null;
  const activePickAuthor = activePick?.author;
  const activePickAuthorName = activePickAuthor?.username || activePickAuthor?.email || '익명';
  const activePickAuthorImage = activePickAuthor?.profileImage || null;
  const editorPickHref = activePick?.blog?.slug
    ? `/${activePick.blog.slug}/${activePick.slug || activePick.id}`
    : '/c';
  const hasMultiplePicks = editorPickPosts.length > 1;
  const shouldShowPickIndicators = editorPickPosts.length > 0;
  const editorPickWrapperClass = activePickImage
    ? 'cursor-pointer relative border border-[#D9E0EA] bg-white shadow-sm overflow-hidden dark:border-[#4B5563] dark:bg-[#0E141B]'
    : 'cursor-pointer relative border border-[#D9E0EA] bg-[#F7F9FC] shadow-sm dark:border-[#4B5563] dark:bg-[#131A22]';
  const pickContentSpacingClass = activePickImage ? 'mt-0' : 'px-8';

  useEffect(() => {
    if (activePickIndex >= editorPickPosts.length) {
      setActivePickIndex(0);
    }
  }, [activePickIndex, editorPickPosts.length]);

  useEffect(() => {
    if (editorPickPosts.length > 0) {
      setActivePickIndex(0);
    }
  }, [editorPickPosts[0]?.id]);

  const handlePickPrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActivePickIndex((prev) =>
      editorPickPosts.length ? (prev - 1 + editorPickPosts.length) % editorPickPosts.length : 0,
    );
  }, [editorPickPosts.length]);

  const handlePickNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActivePickIndex((prev) =>
      editorPickPosts.length ? (prev + 1) % editorPickPosts.length : 0,
    );
  }, [editorPickPosts.length]);

  // 스크롤 위치 복원
  useScrollRestoration('home-page');

  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  // URL에서 검색 파라미터 파싱
  const currentParams = parseSearchParams(searchParams.toString());

  // 통합 피드 조회
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useUnifiedFeed({
    filter: 'all',
    sort: sortBy,
    limit: 20,
  });

  const { mutateAsync: votePost } = useVote({
    onRequireLogin: () => {
      router.push('/login');
    },
  });

  const { mutateAsync: voteCommunityPost } = useMutation<VoteResponse, Error, { communitySlug: string; postId: string; voteType: 'upvote' | 'downvote' }>({
    mutationFn: ({ communitySlug, postId, voteType }) =>
      communityService.votePost(communitySlug, postId, voteType),
  });

  // 모든 아이템 플래튼 - 메모이제이션 (중복 제거)
  const allItems = useMemo(() => {
    if (!data?.pages) return [];

    const itemsMap = new Map<string, FeedItemType>();
    data.pages.forEach(page => {
      page.items.forEach(item => {
        if (item && item.id) {
          itemsMap.set(item.id, item);
        }
      });
    });
    return Array.from(itemsMap.values());
  }, [data?.pages]);

  const filteredItems = useMemo(() => {
    if (!currentParams.search) return allItems;
    const term = currentParams.search.toLowerCase();
    return allItems.filter(item => {
      const titleMatch = item.title?.toLowerCase().includes(term);
      const excerptMatch = item.excerpt?.toLowerCase().includes(term);
      return titleMatch || excerptMatch;
    });
  }, [allItems, currentParams.search]);

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    target?: {
      id: string;
      title: string;
      type: FeedSourceType;
      blogSlug?: string | null;
      communitySlug?: string | null;
      postSlug?: string | null;
    };
  }>({ isOpen: false });

  const deletePostMutation = useDeletePost();
  const deleteCommunityMutation = useMutation<
    void,
    Error,
    { communitySlug: string; postId: string; postSlug: string | null }
  >({
    mutationFn: ({ communitySlug, postId }) =>
      communityService.deletePost(communitySlug, postId),
    onSuccess: (_, variables) => {
      queryClient.setQueriesData(
        { queryKey: feedQueryKeys.all },
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              items: page.items.filter((item) => {
                if (item.sourceType !== 'community') return true;
                if (item.community?.slug !== variables.communitySlug) return true;
                const isSameSlug = variables.postSlug && item.slug === variables.postSlug;
                const isSameId = item.id === variables.postId;
                return !(isSameSlug || isSameId);
              }),
            })),
          };
        },
      );
      setDeleteDialog({ isOpen: false });
    },
  });

  const itemMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        type: FeedSourceType;
        blogSlug?: string | null;
        communitySlug?: string | null;
        postSlug?: string | null;
        title: string;
      }
    >();
    filteredItems.forEach((item) => {
      map.set(item.id, {
        type: item.sourceType,
        blogSlug: item.blog?.slug || item.blog?.alias || null,
        communitySlug: item.community?.slug || null,
        postSlug: item.slug || null,
        title: item.title || '게시글',
      });
    });
    return map;
  }, [filteredItems]);

  // 실제 포스트에서 태그 추출 - 메모이제이션
  const tags = useMemo(() => {
    const tagMap = new Map<string, number>();

    filteredItems.forEach(item => {
      if (item && item.tags && Array.isArray(item.tags)) {
        item.tags.forEach((tag: string) => {
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
  }, [filteredItems]);

  const pendingCursorRef = useRef<string | null>(null);
  const lastPageCursor = data?.pages?.[data.pages.length - 1]?.nextCursor ?? null;

  const loadMorePosts = useCallback(() => {
    if (!hasNextPage || isFetchingNextPage) {
      return;
    }
    const cursorToUse = lastPageCursor ?? '__INITIAL__';
    if (pendingCursorRef.current === cursorToUse) {
      return;
    }
    pendingCursorRef.current = cursorToUse;
    fetchNextPage().finally(() => {
      pendingCursorRef.current = null;
    });
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, lastPageCursor]);

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

  const handleEditPost = useCallback(
    (postId: string) => {
      const meta = itemMetaMap.get(postId);
      if (!meta) return;
      if (meta.type === 'community' && meta.communitySlug && meta.postSlug) {
        router.push(`/c/${meta.communitySlug}/comments/${meta.postSlug}/edit`);
        return;
      }
      router.push(`/p/${postId}/edit`);
    },
    [itemMetaMap, router],
  );

  const handleDeletePost = useCallback(
    (postId: string) => {
      const meta = itemMetaMap.get(postId);
      if (!meta) return;
      setDeleteDialog({
        isOpen: true,
        target: {
          id: postId,
          title: meta.title,
          type: meta.type,
          blogSlug: meta.blogSlug,
          communitySlug: meta.communitySlug,
          postSlug: meta.postSlug,
        },
      });
    },
    [itemMetaMap],
  );

  const handleCloseDeleteDialog = useCallback(() => {
    if (deletePostMutation.isPending || deleteCommunityMutation.isPending) {
      return;
    }
    setDeleteDialog({ isOpen: false });
  }, [deletePostMutation.isPending, deleteCommunityMutation.isPending]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteDialog.target) return;
    if (deleteDialog.target.type === 'community') {
      const communitySlug = deleteDialog.target.communitySlug;
      if (!communitySlug) {
        console.error('[HomeFeed] Missing community slug for delete target', deleteDialog.target);
        return;
      }
      deleteCommunityMutation.mutate({
        communitySlug,
        postId: deleteDialog.target.id,
        postSlug: deleteDialog.target.postSlug ?? null,
      });
      return;
    }

    deletePostMutation.mutate(deleteDialog.target.id, {
      onSuccess: () => setDeleteDialog({ isOpen: false }),
    });
  }, [deleteDialog.target, deleteCommunityMutation, deletePostMutation]);

  const handleVote = useCallback(
    (targetItem: FeedItemType, voteType: 'upvote' | 'downvote') => {
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      const previousData = queryClient.getQueryData<InfiniteData<UnifiedFeedResponse>>(feedQueryKey);

      queryClient.setQueryData(
        feedQueryKey,
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;

          const updatedPages = oldData.pages.map(page => ({
            ...page,
            items: page.items.map(item => {
              if (item.id !== targetItem.id) return item;

              let upvoteCount = item.upvoteCount ?? item.likeCount ?? 0;
              let downvoteCount = item.downvoteCount ?? 0;
              let nextVote: VoteType = item.userVote ?? null;

              if (nextVote === voteType) {
                nextVote = null;
                if (voteType === 'upvote') {
                  upvoteCount = Math.max(0, upvoteCount - 1);
                } else {
                  downvoteCount = Math.max(0, downvoteCount - 1);
                }
              } else if (nextVote === null) {
                nextVote = voteType;
                if (voteType === 'upvote') {
                  upvoteCount += 1;
                } else {
                  downvoteCount += 1;
                }
              } else {
                nextVote = voteType;
                if (voteType === 'upvote') {
                  upvoteCount += 1;
                  downvoteCount = Math.max(0, downvoteCount - 1);
                } else {
                  upvoteCount = Math.max(0, upvoteCount - 1);
                  downvoteCount += 1;
                }
              }

              return {
                ...item,
                userVote: nextVote,
                upvoteCount,
                downvoteCount,
                score: upvoteCount - downvoteCount,
                likeCount: upvoteCount,
              };
            }),
          }));

          return { ...oldData, pages: updatedPages };
        }
      );

      setPendingPostId(targetItem.id);

      let mutationPromise: Promise<VoteResponse>;
      if (targetItem.sourceType === 'community') {
        const communitySlug = targetItem.community?.slug;
        if (!communitySlug) {
          setPendingPostId(null);
          if (previousData) {
            queryClient.setQueryData(feedQueryKey, previousData);
          }
          return;
        }
        mutationPromise = voteCommunityPost({
          communitySlug,
          postId: targetItem.id,
          voteType,
        });
      } else {
        mutationPromise = votePost({ postId: targetItem.id, voteType });
      }

      mutationPromise
        .catch((err) => {
          if (previousData) {
            queryClient.setQueryData(feedQueryKey, previousData);
          }
          if (err instanceof Error) {
            console.error('[HomeFeed] vote failed:', err.message);
          }
        })
        .finally(() => {
          setPendingPostId((current) => (current === targetItem.id ? null : current));
        });
    },
    [feedQueryKey, isAuthenticated, queryClient, router, voteCommunityPost, votePost]
  );

  if (error) {
    return (
      <ErrorMessage 
        message={`오류가 발생했습니다: ${error.message}`}
        showBackButton={false}
      />
    );
  }

  return (
    <div className="w-full bg-white text-[#1B2430] dark:bg-[#0E141B] dark:text-[#E6EDF3]">
      <div className="max-w-7xl mx-auto px-6 pb-16 pt-16">
        <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pt-0">
          <div className="space-y-6">
            <div className="max-w-[780px] mx-auto space-y-6">
              <div 
                className={editorPickWrapperClass}
                onClick={() => router.push(editorPickHref)}
              >
                {!activePickImage && (
                  <span className="absolute left-6 top-6 inline-flex items-center rounded-full bg-[#C1121F] px-3.5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-white dark:bg-[#E11D48]">
                    EDITOR&apos;S PICK
                  </span>
                )}
                <div className={`${pickContentSpacingClass} space-y-3`}>
                  {isEditorPicksLoading ? (
                    <div className="h-[240px] animate-pulse rounded-2xl border border-[#D9E0EA] bg-white shadow-sm dark:border-[#4B5563] dark:bg-[#0E141B]" />
                  ) : editorPickPosts.length === 0 ? (
                    <div className="rounded-2xl border border-[#D9E0EA] bg-white p-6 text-sm text-[#4B5563] shadow-sm dark:border-[#4B5563] dark:bg-[#0E141B] dark:text-[#A9B4C2]">
                      아직 선정된 Editor&apos;s Pick이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative h-[360px] w-full">
                        {activePickImage ? (
                          <>
                            <div className="relative h-full w-full">
                              <Image
                                src={activePickImage}
                                alt={activePick?.title || 'Editor pick'}
                                fill
                                sizes="(max-width: 640px) 100vw, 780px"
                                className="object-cover"
                                priority={activePickIndex === 0}
                                unoptimized={shouldDisableOptimization(activePickImage)}
                              />
                              <div className="absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                              <div className="absolute left-6 top-6 z-10 rounded-full bg-[#C1121F] px-3.5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-white dark:bg-[#E11D48]">
                                EDITOR&apos;S PICK
                              </div>
                              <div className="absolute inset-x-0 bottom-16 z-10 px-6">
                                <h3 className="text-xl font-semibold text-white sm:text-2xl">
                                  {activePick?.title}
                                </h3>
                                <div className="mt-3 flex items-center gap-2 text-sm text-white/85">
                                  <Avatar
                                    src={activePickAuthorImage}
                                    alt={activePickAuthorName}
                                    size="xs"
                                    className="ring-1 ring-white/60 bg-white/20"
                                  />
                                  <span className="font-medium">{activePickAuthorName}</span>
                                </div>
                              </div>
                              <div className="absolute inset-x-0 bottom-4 z-10 grid grid-cols-[1fr_auto_1fr] items-center px-6">
                                <div />
                                {shouldShowPickIndicators && (
                                  <div className="flex items-center gap-2 rounded-full bg-black/35 px-3 py-1">
                                    {editorPickPosts.map((_, index) => (
                                      <button
                                        key={`editor-pick-dot-${index}`}
                                        type="button"
                                        onClick={() => setActivePickIndex(index)}
                                        className={`transition-all duration-300 rounded-full ${
                                          activePickIndex === index
                                            ? 'w-5 h-2 bg-white'
                                            : 'w-2 h-2 bg-white/50 hover:bg-white/70'
                                        }`}
                                        aria-label={`Editor&apos;s Pick ${index + 1}로 이동`}
                                      />
                                    ))}
                                  </div>
                                )}
                                <div className="justify-self-end">
                                    <Link
                                    href={editorPickHref}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0B1220] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171] dark:bg-[#0B0F14] dark:hover:bg-[#111827] dark:focus-visible:ring-[#F87171]"
                                  >
                                    바로 가기
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="flex h-full flex-col pt-16 pb-4">
                            <div className="space-y-3">
                              <h3 className="text-2xl font-semibold tracking-[-0.01em] leading-tight sm:text-3xl">
                                {activePick?.title}
                              </h3>
                              <p
                                className="text-[15px] text-[#3F4A59] dark:text-[#E1E8F0] leading-relaxed"
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 4,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                }}
                              >
                                {activePick?.editorPickExcerpt || activePick?.excerpt || '요약이 없는 포스트입니다.'}
                              </p>
                            </div>
                            <div className="mt-auto space-y-4">
                              <div className="flex items-center gap-2 text-xs text-[#4B5563] dark:text-[#A9B4C2]">
                                <Avatar
                                  src={activePickAuthorImage}
                                  alt={activePickAuthorName}
                                  size="xs"
                                  className="ring-1 ring-black/10 dark:ring-white/20"
                                />
                                <span className="font-medium">{activePickAuthorName}</span>
                              </div>
                              <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                                <div />
                                {shouldShowPickIndicators && (
                                  <div className="flex items-center gap-2">
                                    {editorPickPosts.map((_, index) => (
                                      <button
                                        key={`editor-pick-dot-${index}`}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActivePickIndex(index);
                                        }}
                                        className={`transition-all duration-300 rounded-full ${
                                          activePickIndex === index
                                            ? 'w-6 h-2 bg-[#264653] dark:bg-[#6CC3B2]'
                                            : 'w-2 h-2 bg-[#D9E0EA] dark:bg-[#2A3645] hover:bg-[#C9D3E0] dark:hover:bg-[#223040]'
                                        }`}
                                        aria-label={`Editor&apos;s Pick ${index + 1}로 이동`}
                                      />
                                    ))}
                                  </div>
                                )}
                                <div className="justify-self-end">
                                  <Link
                                    href={editorPickHref}
                                    onClick={(e) => e.stopPropagation()}
                                    className="rounded-full border border-[#111827] px-4 py-2 text-sm font-semibold text-[#111827] transition-colors hover:bg-[#111827] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F87171] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-[#E6EDF3] dark:text-[#E6EDF3] dark:hover:bg-[#E6EDF3] dark:hover:text-[#0E141B] dark:focus-visible:ring-[#F87171] dark:focus-visible:ring-offset-[#0E141B]"
                                  >
                                    바로 가기
                                  </Link>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      {hasMultiplePicks && (
                        <>
                          <button
                            type="button"
                            onClick={handlePickPrev}
                            className="absolute left-6 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="이전 Editor's Pick"
                          >
                            <ChevronLeft className="h-5 w-5" />
                          </button>
                          <button
                            type="button"
                            onClick={handlePickNext}
                            className="absolute right-6 top-1/2 z-20 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                            aria-label="다음 Editor's Pick"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>


            </div>
            <div className="max-w-[780px] mx-auto flex flex-wrap gap-2">
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

            <div className="space-y-3 sm:space-y-4">
            {isLoading && filteredItems.length === 0 ? (
              // 초기 로딩 시 스켈레톤 UI 표시
              <PostSkeletonWithShimmer count={5} tone="harbor" />
            ) : filteredItems.length > 0 ? (
              <>
                {filteredItems.map((item, index) => {
                  const adapted = adaptUnifiedFeedItem(item);
                  const shouldBlurMedia = item.isNsfw && !isAdultVerified;
                  const communityContext = adapted.communityContext
                    ? { ...adapted.communityContext, shouldBlurMedia }
                    : undefined;

                  const hasImage = !!(item.thumbnail || (item.images && item.images.length > 0));
                  // 이미지 유무에 따라 예상 높이 조정 (이미지 있을 때: ~640px, 없을 때: ~280px)
                  const estimatedHeight = hasImage ? 640 : 280;

                  return (
                    <VirtualizedPostItem
                      key={item.id}
                      initialVisible={index < 5}
                      placeholder={<HomeFeedPlaceholderCard hasImage={hasImage} />}
                      estimatedHeight={estimatedHeight}
                    >
                      <PostArticle
                        post={adapted.post}
                        isAdmin={isAdmin}
                        isAuthenticated={isAuthenticated}
                        userId={user?.id}
                        onEdit={handleEditPost}
                        onDelete={handleDeletePost}
                        onVote={(_, voteType) => handleVote(item, voteType)}
                        votePending={pendingPostId === item.id}
                        searchQuery={currentParams.search}
                        priority={index < 3}
                        isHomeFeed
                        postUrlOverride={adapted.postUrl}
                        communityContext={communityContext}
                      />
                    </VirtualizedPostItem>
                  );
                })}
                
                {/* 무한 스크롤 트리거 */}
                  <InfiniteScrollTrigger
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  totalPosts={filteredItems.length}
                  currentPostsCount={filteredItems.length}
                  onLoadMore={loadMorePosts}
                  error={null}
                  onRetry={loadMorePosts}
                  tone="harbor"
                />
              </>
            ) : (
              <div className="text-center py-12 text-[#4B5563] dark:text-[#A9B4C2]">
                <p className="text-sm sm:text-base">아직 포스트가 없습니다.</p>
              </div>
            )}
            </div>
          </div>
          </main>

          {/* Sidebar - sticky positioning */}
          <aside className="hidden lg:block lg:sticky lg:top-28 lg:h-[calc(100vh-7rem)] lg:overflow-y-auto sidebar-scroll bg-white dark:bg-[#0E141B]">
          <div className="space-y-4 sm:space-y-6">
            {/* My Communities - 최상단 */}
            {user && (
              <Suspense fallback={<div className="h-72 bg-[#EEF3F8] dark:bg-[#1A232E] animate-pulse rounded-3xl" />}>
                <MyCommunitiesSection />
              </Suspense>
            )}

            {/* Trending Community Posts */}
            <Suspense fallback={<div className="h-64 bg-[#EEF3F8] dark:bg-[#1A232E] animate-pulse rounded-3xl" />}>
              <TrendingCommunityPostsSection />
            </Suspense>

            {/* Popular Blog Posts */}
            <Suspense fallback={<div className="h-96 bg-[#EEF3F8] dark:bg-[#1A232E] animate-pulse rounded-3xl" />}>
              <PopularPostsSection />
            </Suspense>

            {/* Connections 섹션 - Lazy Loading */}
            {user && (
              <Suspense fallback={<div className="h-64 bg-[#EEF3F8] dark:bg-[#1A232E] animate-pulse rounded-3xl" />}>
                <ConnectionsSection userId={user.id} />
              </Suspense>
            )}

            <SidebarCtaSection />

            {/* Writing Styles (Promo) - 최하단 */}
            <Suspense fallback={<div className="h-48 bg-[#EEF3F8] dark:bg-[#1A232E] animate-pulse rounded-3xl" />}>
              <PromoCarouselSection />
            </Suspense>

            {/* 사이드바 푸터 */}
            <SidebarFooter />
          </div>
          </aside>
        </div>
      </div>

      <DeleteConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleConfirmDelete}
        isLoading={
          deletePostMutation.isPending || deleteCommunityMutation.isPending
        }
        title={deleteDialog.target?.title}
      />
    </div>
  );
}

/**
 * 홈 페이지 (Suspense 래퍼)
 */
export default function HomePage() {
  return (
    <Suspense fallback={<PostSkeletonWithShimmer count={5} tone="harbor" />}>
      <HomePageContent />
    </Suspense>
  );
}
