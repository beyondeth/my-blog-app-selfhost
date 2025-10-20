'use client';

import { useState, useRef, useEffect } from 'react';
import { FiMessageCircle, FiTrendingUp, FiClock, FiMenu, FiChevronDown, FiCheck } from 'react-icons/fi';
import {
  useParentCommentsPaginated,
  useCreateCommentPaginated,
  flattenPaginatedComments,
} from '@/hooks/useCommentsPaginated';
import CommentForm from './CommentForm';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import CommentItemPaginated from './CommentItemPaginated';

interface CommentSectionPaginatedProps {
  postId: string;
  postAuthorId?: string;
  totalCommentCount?: number; // Total comment count from parent (includes all replies)
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
export default function CommentSectionPaginated({ postId, postAuthorId, totalCommentCount }: CommentSectionPaginatedProps) {
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
  });

  // 댓글 작성 mutation
  const createCommentMutation = useCreateCommentPaginated(postId);

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

  // 드롭다운 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSortDropdown(false);
      }
    };

    if (showSortDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

  // 정렬 변경 핸들러
  const handleSortChange = (newSort: SortType) => {
    if (newSort !== sortType) {
      setSortType(newSort);
      setSnapshotTimestamp(undefined); // 스냅샷 리셋
      setShowSortDropdown(false);
    }
  };

  // 댓글 작성 핸들러
  const handleCreateComment = (content: string) => {
    createCommentMutation.mutate({
      content,
      postId,
    });
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
    <section className="mt-16 pt-8 border-t border-gray-200 dark:border-gray-700">
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
            className="inline-flex items-center px-4 py-2 text-[13px] font-medium rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
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

      {/* 댓글 작성 폼 */}
      <div className="mb-8">
        <CommentForm
          postId={postId}
          onSubmit={handleCreateComment}
          isLoading={createCommentMutation.isPending}
          placeholder="댓글을 작성해주세요..."
          maxLength={1000}
        />
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
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
                >
                  더 보기
                </button>
              )}
            </div>
          )}

          {!isLoading && flatComments.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              아직 댓글이 없습니다. 첫 댓글을 작성해보세요!
            </div>
          )}
        </div>
      )}
    </section>
  );
}
