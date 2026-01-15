'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useUnifiedFeed } from '@/hooks/feed';
import { FeedFilterType, FeedSortType, type UnifiedFeedItem as FeedItemType, type UnifiedFeedResponse } from '@/services/api/feed.service';
import UnifiedFeedItem from './UnifiedFeedItem';
import FeedFilterTabs from './FeedFilterTabs';
import InfiniteScrollTrigger from '@/components/posts/InfiniteScrollTrigger';
import { PostSkeletonWithShimmer } from '@/components/posts/PostSkeleton';
import { useVote } from '@/hooks/useVote';
import type { VoteResponse, VoteType } from '@/types';
import { communityService } from '@/services/api/community.service';

/**
 * UnifiedFeed 컴포넌트 Props
 */
interface UnifiedFeedProps {
  /** 초기 필터 (기본값: 'all') */
  initialFilter?: FeedFilterType;
  /** 초기 정렬 (기본값: 'recent') */
  initialSort?: FeedSortType;
  /** 페이지당 아이템 수 (기본값: 20) */
  limit?: number;
  /** 필터 탭 표시 여부 (기본값: true) */
  showFilterTabs?: boolean;
}

/**
 * 통합 피드 컴포넌트
 *
 * @description 블로그 포스트와 커뮤니티 포스트를 통합하여 무한 스크롤로 표시
 *
 * **특징:**
 * - 필터링 (전체/블로그/커뮤니티)
 * - 정렬 (최신순/인기순)
 * - 커서 기반 무한 스크롤
 * - 로딩 상태 스켈레톤
 *
 * @example
 * ```tsx
 * // 기본 사용
 * <UnifiedFeed />
 *
 * // 필터/정렬 초기값 지정
 * <UnifiedFeed initialFilter="blog" initialSort="hot" />
 *
 * // 필터 탭 숨김
 * <UnifiedFeed showFilterTabs={false} />
 * ```
 */
export default function UnifiedFeed({
  initialFilter = 'all',
  initialSort = 'recent',
  limit = 20,
  showFilterTabs = true,
}: UnifiedFeedProps) {
  // 필터 및 정렬 상태
  const [filter, setFilter] = useState<FeedFilterType>(initialFilter);
  const [sort, setSort] = useState<FeedSortType>(initialSort);
  const queryClient = useQueryClient();
  const feedQueryKey = useMemo(() => ['unified-feed', filter, sort, limit] as const, [filter, sort, limit]);

  const requireLogin = useCallback(() => {
    alert('로그인이 필요합니다.\n로그인 후 좋아요/안 좋아요를 사용할 수 있습니다.');
  }, []);

  const { mutateAsync: votePost } = useVote({
    onRequireLogin: requireLogin,
  });

  const { mutateAsync: voteCommunityPost } = useMutation<VoteResponse, Error, { communitySlug: string; postId: string; voteType: 'upvote' | 'downvote' }>({
    mutationFn: ({ communitySlug, postId, voteType }) =>
      communityService.votePost(communitySlug, postId, voteType),
  });

  const [pendingPostId, setPendingPostId] = useState<string | null>(null);

  // 통합 피드 데이터 조회
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error,
    refetch,
  } = useUnifiedFeed({
    filter,
    sort,
    limit,
  });

  // 모든 아이템 플랫화 (중복 제거)
  const allItems = useMemo(() => {
    if (!data?.pages) return [];

    const itemsMap = new Map();
    data.pages.forEach((page) => {
      page.items.forEach((item) => {
        if (item && item.id) {
          itemsMap.set(item.id, item);
        }
      });
    });

    return Array.from(itemsMap.values());
  }, [data?.pages]);

  // 더 보기 핸들러
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 필터 변경 핸들러
  const handleFilterChange = useCallback((newFilter: FeedFilterType) => {
    setFilter(newFilter);
  }, []);

  // 정렬 변경 핸들러
  const handleSortChange = useCallback((newSort: FeedSortType) => {
    setSort(newSort);
  }, []);

  // 통합 피드 투표 핸들러 (낙관적 업데이트 포함)
  const handleVote = useCallback(
    (targetItem: FeedItemType, voteType: 'upvote' | 'downvote') => {
      const previousData = queryClient.getQueryData<InfiniteData<UnifiedFeedResponse>>(feedQueryKey);

      queryClient.setQueryData(
        feedQueryKey,
        (oldData: InfiniteData<UnifiedFeedResponse> | undefined) => {
          if (!oldData?.pages) return oldData;

          const updatedPages = oldData.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (item.id !== targetItem.id) return item;

              let upvoteCount = item.upvoteCount ?? item.likeCount ?? 0;
              let downvoteCount = item.downvoteCount ?? 0;
              let nextVote: VoteType = item.userVote ?? null;

              if (nextVote === voteType) {
                nextVote = null;
                if (voteType === 'upvote') upvoteCount = Math.max(0, upvoteCount - 1);
                else downvoteCount = Math.max(0, downvoteCount - 1);
              } else if (nextVote === null) {
                nextVote = voteType;
                if (voteType === 'upvote') upvoteCount += 1;
                else downvoteCount += 1;
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
        if (!targetItem.community?.slug) {
          setPendingPostId(null);
          if (previousData) {
            queryClient.setQueryData(feedQueryKey, previousData);
          }
          return;
        }
        mutationPromise = voteCommunityPost({
          communitySlug: targetItem.community.slug,
          postId: targetItem.id,
          voteType,
        });
      } else {
        mutationPromise = votePost({ postId: targetItem.id, voteType });
      }

      mutationPromise.catch((error) => {
        if (previousData) {
          queryClient.setQueryData(feedQueryKey, previousData);
        }
        if (error instanceof Error) {
          console.error('[UnifiedFeed] vote failed:', error.message);
        }
      }).finally(() => {
        setPendingPostId((current) => (current === targetItem.id ? null : current));
      });
    },
    [feedQueryKey, queryClient, voteCommunityPost, votePost]
  );

  // 에러 상태
  if (error) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm sm:text-base mb-4">
          피드를 불러오는 중 오류가 발생했습니다.
        </p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* 필터 탭 */}
      {showFilterTabs && (
        <FeedFilterTabs
          filter={filter}
          sort={sort}
          onFilterChange={handleFilterChange}
          onSortChange={handleSortChange}
        />
      )}

      {/* 피드 아이템 */}
      {isLoading && allItems.length === 0 ? (
        // 초기 로딩 시 스켈레톤 UI 표시
        <PostSkeletonWithShimmer count={5} />
      ) : allItems.length > 0 ? (
        <>
          {allItems.map((item, index) => (
            <UnifiedFeedItem
              key={item.id}
              item={item}
              onVote={handleVote}
              votePending={pendingPostId === item.id}
              priority={index < 3} // LCP 최적화: 상위 3개 프로필 이미지 즉시 로드
            />
          ))}

          {/* 무한 스크롤 트리거 */}
          <InfiniteScrollTrigger
            hasNextPage={!!hasNextPage}
            isFetchingNextPage={isFetchingNextPage}
            totalPosts={allItems.length}
            currentPostsCount={allItems.length}
            onLoadMore={loadMore}
            error={error}
            onRetry={() => fetchNextPage()}
          />
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p className="text-sm sm:text-base">
            {filter === 'blog' && '아직 블로그 포스트가 없습니다.'}
            {filter === 'community' && '아직 커뮤니티 포스트가 없습니다.'}
            {filter === 'all' && '아직 포스트가 없습니다.'}
          </p>
        </div>
      )}
    </div>
  );
}
