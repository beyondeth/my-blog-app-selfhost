'use client';

import { useState, useRef, useEffect } from 'react';
import { FiMessageCircle, FiTrendingUp, FiClock, FiMenu, FiChevronDown, FiCheck } from 'react-icons/fi';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/hooks/useComments';
import CommentForm from './CommentForm';
import CommentList from './CommentList';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { CommentProvider, useCommentStore } from '@/contexts/CommentContext';

interface CommentSectionProps {
  postId: string;
  postAuthorId?: string; // For highlighting post author comments
  totalCommentCount?: number; // Total comment count from parent
}

type SortType = 'popular' | 'latest';

function CommentSectionContent({ postId, postAuthorId, totalCommentCount }: CommentSectionProps) {
  const [sortType, setSortType] = useState<SortType>('popular');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // postId가 없으면 댓글을 로드하지 않음
  const { data: comments, isLoading, error, isError } = useComments(postId, {
    enabled: !!postId && postId !== 'undefined'
  });
  const { setRepliesExpanded } = useCommentStore();
  
  const handleReplyAdded = (parentId: string) => {
    setRepliesExpanded(parentId, true);
  };

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
  
  const createCommentMutation = useCreateComment(postId, handleReplyAdded);
  const updateCommentMutation = useUpdateComment(postId);
  const deleteCommentMutation = useDeleteComment(postId);

  const handleCreateComment = (content: string) => {
    createCommentMutation.mutate({
      content,
      postId,
    });
  };

  const handleCreateReply = (content: string, parentCommentId: string) => {
    createCommentMutation.mutate({
      content,
      postId,
      parentCommentId,
    });
  };

  const handleUpdateComment = (id: string, content: string) => {
    updateCommentMutation.mutate({ id, content });
  };

  const handleDeleteComment = (id: string) => {
    deleteCommentMutation.mutate(id);
  };

  // Sort comments based on selected type
  const sortedComments = comments ? [...comments].sort((a, b) => {
    if (sortType === 'latest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else {
      // Popular sort - by likes count (we'll implement likes later)
      return (b.likesCount || 0) - (a.likesCount || 0);
    }
  }) : [];

  const isAnyLoading = 
    createCommentMutation.isPending || 
    updateCommentMutation.isPending || 
    deleteCommentMutation.isPending;

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
            댓글 {totalCommentCount ?? comments?.length ?? 0}개
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
                onClick={() => {
                  setSortType('popular');
                  setShowSortDropdown(false);
                }}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FiTrendingUp className="w-4 h-4" />
                  <span>인기순</span>
                </div>
                {sortType === 'popular' && <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
              </button>
              <button
                onClick={() => {
                  setSortType('latest');
                  setShowSortDropdown(false);
                }}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FiClock className="w-4 h-4" />
                  <span>최신순</span>
                </div>
                {sortType === 'latest' && <FiCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
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
        <CommentList
          comments={sortedComments}
          onUpdate={handleUpdateComment}
          onDelete={handleDeleteComment}
          onReply={handleCreateReply}
          isLoading={isAnyLoading}
          postAuthorId={postAuthorId}
          sortType={sortType}
        />
      )}
      </section>
    );
}

export default function CommentSection({ postId, postAuthorId }: CommentSectionProps) {
  return (
    <CommentProvider>
      <CommentSectionContent postId={postId} postAuthorId={postAuthorId} />
    </CommentProvider>
  );
}