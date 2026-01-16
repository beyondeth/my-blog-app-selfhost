'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FiMessageCircle, FiTrendingUp, FiClock, FiMenu, FiChevronDown, FiCheck } from 'react-icons/fi';
import { AlertTriangle } from 'lucide-react';
import {
  useParentCommentsPaginated,
  useCreateCommentPaginated,
  flattenPaginatedComments,
} from '@/hooks/useCommentsPaginated';
import CommentForm from './CommentForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CommentItemPaginated from './CommentItemPaginated';
import type { CommentContext } from '@/lib/api/endpoints/comments';
import type { Community } from '@/types/community';
import { getOutsideClickEvent } from '@/utils/interaction';
import { useMobileOverlayReset } from '@/hooks/useMobileOverlayReset';

interface CommentSectionPaginatedProps {
  postId: string;
  postAuthorId?: string;
  totalCommentCount?: number; // Total comment count from parent (includes all replies)
  context?: CommentContext;
  isCommunityLocked?: boolean;
  lockedAt?: string | null;
  lockedBy?: Community['lockedBy'];
  communitySlug?: string;
}

type SortType = 'recent' | 'popular';

/**
 * 페이지네이션된 댓글 섹션 컴포넌트
 *
 * @description
 * - 무한 스크롤 기반 부모 댓글 로드
 * - 최신순/인기순 정렬 탭
 * - 스냅샷 타임스탬프 방식으로 인기순 안정성 확보
 * - IntersectionObserver 기반 자동 다음 페이지 로드
 *
 * @최적화
 * - staleTime: 0 (Redis 캐시 의존)
 * - 첫 페이지만 Redis 캐싱 (TTL 10초)
 * - 정렬 변경 시 전체 리셋
 */
export default function CommentSectionPaginated({
  postId,
  postAuthorId,
  totalCommentCount,
  context,
  isCommunityLocked = false,
  lockedAt,
  lockedBy,
  communitySlug,
}: CommentSectionPaginatedProps) {
  const [sortType, setSortType] = useState<SortType>('popular');
  const [snapshotTimestamp, setSnapshotTimestamp] = useState<string | undefined>();
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // 무한 스크롤 감지를 위한 ref
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 부모 댓글 페이지네이션 쿼리
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
  } = useParentCommentsPaginated(postId, {
    sort: sortType,
    limit: 20,
    snapshotTimestamp,
  }, context);

  // 댓글 작성 mutation
  const createCommentMutation = useCreateCommentPaginated(postId, sortType === 'recent' ? 'newest' : sortType, context);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // 스냅샷 타임스탬프 저장 (인기순 정렬 시)
  useEffect(() => {
    if (data?.pages?.[0]?.snapshotTimestamp && sortType === 'popular') {
      setSnapshotTimestamp(data.pages[0].snapshotTimestamp);
    }
  }, [data?.pages, sortType]);

  // IntersectionObserver로 무한 스크롤 구현
  useEffect(() => {
    if (!loadMoreRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const closeSortDropdown = useCallback(() => {
    setShowSortDropdown(false);
  }, []);

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeSortDropdown();
      }
    };

    if (showSortDropdown) {
      const outsideEvent = getOutsideClickEvent();
      document.addEventListener(outsideEvent, handleClickOutside);
      return () => {
        document.removeEventListener(outsideEvent, handleClickOutside);
      };
    }

    return undefined;
  }, [showSortDropdown, closeSortDropdown]);

  useMobileOverlayReset(closeSortDropdown, showSortDropdown);

  // 정렬 변경 핸들러
  const handleSortChange = (newSort: SortType) => {
    if (newSort !== sortType) {
      setSortType(newSort);
      setSnapshotTimestamp(undefined); // 스냅샷 리셋
      setShowSortDropdown(false);
    }
  };

  // 댓글 작성 핸들러
  const handleCreateComment = async (content: string) => {
    if (isCommunityLocked) {
      return;
    }
    setIsSubmittingComment(true);
    try {
      await createCommentMutation.mutateAsync({
        content,
        postId,
      });
    } catch (error) {
      console.error('댓글 작성 실패:', error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // 평탄화된 댓글 목록
  const flatComments = flattenPaginatedComments(data);

  if (isError) {
    return (
      <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
        <ErrorMessage
          message={error?.message || '댓글을 불러오는데 실패했습니다.'}
        />
      </section>
    );
  }

  return (
    <section className="mt-16 pt-8">
      {/* 댓글 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FiMessageCircle className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            댓글 {totalCommentCount !== undefined ? `${totalCommentCount}개` : ''}
          </h2>
        </div>

        {/* 정렬 기준 드롭다운 */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowSortDropdown(!showSortDropdown)}
            className="inline-flex items-center px-4 py-2 text-[13px] font-semibold rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <FiMenu className="w-4 h-4 mr-2" />
            정렬 기준
            <FiChevronDown className="w-4 h-4 ml-2" />
          </button>

          {/* 드롭다운 메뉴 */}
          {showSortDropdown && (
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
              <button
                onClick={() => handleSortChange('popular')}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4" />
                  <span>인기순</span>
                </div>
                {sortType === 'popular' && <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>
              <button
                onClick={() => handleSortChange('recent')}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FiClock className="w-4 h-4" />
                  <span>최신순</span>
                </div>
                {sortType === 'recent' && <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 댓글 작성 폼 / 잠금 안내 */}
      <div className="mb-8">
        {isCommunityLocked ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/40 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <div className="space-y-1 text-sm text-amber-900 dark:text-amber-100">
                <p className="font-semibold">댓글 작성이 일시적으로 제한되었습니다.</p>
                <p className="text-amber-900/80 dark:text-amber-100/80">
                  커뮤니티가 잠금 상태일 때는 새 댓글을 작성할 수 없습니다. 운영팀이 복구를 진행하는 동안 잠시 기다려 주세요.
                </p>
                <div className="text-xs text-amber-900/70 dark:text-amber-100/70">
                  {lockedAt && <span className="mr-2">잠금 일시 {new Date(lockedAt).toLocaleString('ko-KR')}</span>}
                  {lockedBy?.username && <span>담당자 {lockedBy.username}</span>}
                </div>
                {communitySlug && (
                  <Link
                    href={`/c/${communitySlug}/report-moderator`}
                    className="inline-flex text-xs font-semibold text-amber-800 hover:text-amber-900"
                  >
                    운영진 신고 / 복구 요청 하기 →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          <CommentForm
            postId={postId}
            onSubmit={handleCreateComment}
            isLoading={isSubmittingComment}
            placeholder="댓글을 작성해주세요..."
            maxLength={1000}
          />
        )}
      </div>

      {/* 댓글 목록 */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="space-y-4">
          {flatComments.map((comment) => (
            <CommentItemPaginated
              key={comment.id}
              comment={comment}
              postId={postId}
              postAuthorId={postAuthorId}
              context={context}
            />
          ))}

          {/* 무한 스크롤 트리거 */}
          {hasNextPage && (
            <div ref={loadMoreRef} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <LoadingSpinner />
              ) : (
                <button
                  onClick={() => fetchNextPage()}
                  className="text-sm text-gray-700 dark:text-gray-300 font-medium hover:text-black dark:hover:text-white"
                >
                  더 보기
                </button>
              )}
            </div>
          )}

          {!isLoading && flatComments.length === 0 && (
            <div className="text-center py-8 text-sm text-gray-600 dark:text-gray-400">
              아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
            </div>
          )}
        </div>
      )}
    </section>
  );
}
