'use client';

import { useState } from 'react';
import { FiMessageCircle, FiTrendingUp, FiClock } from 'react-icons/fi';
import { useComments, useCreateComment, useUpdateComment, useDeleteComment } from '@/hooks/useComments';
import CommentForm from './CommentForm';
import CommentList from './CommentList';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { CommentProvider, useCommentStore } from '@/contexts/CommentContext';

interface CommentSectionProps {
  postId: string;
  postAuthorId?: string; // For highlighting post author comments
}

type SortType = 'popular' | 'latest';

function CommentSectionContent({ postId, postAuthorId }: CommentSectionProps) {
  const [sortType, setSortType] = useState<SortType>('latest');
  const { data: comments, isLoading, error, isError } = useComments(postId);
  const { setRepliesExpanded } = useCommentStore();
  
  const handleReplyAdded = (parentId: string) => {
    setRepliesExpanded(parentId, true);
  };
  
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
      <section className="mt-16 pt-8 border-t border-gray-200">
        <ErrorMessage 
          message={error?.message || '댓글을 불러오는데 실패했습니다.'} 
        />
      </section>
    );
  }

  return (
    <section className="mt-16 pt-8 border-t border-gray-200">
      {/* 댓글 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <FiMessageCircle className="w-5 h-5 text-gray-700" />
          <h2 className="text-lg font-semibold text-gray-900">
            댓글 {comments?.length || 0}개
          </h2>
        </div>

        {/* YouTube-style 정렬 탭 */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setSortType('popular')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortType === 'popular'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiTrendingUp className="w-4 h-4 inline mr-1" />
            인기순
          </button>
          <button
            onClick={() => setSortType('latest')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              sortType === 'latest'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FiClock className="w-4 h-4 inline mr-1" />
            최신순
          </button>
        </div>
      </div>

      {/* 댓글 작성 폼 */}
      <div className="mb-8">
        <CommentForm
          postId={postId}
          onSubmit={handleCreateComment}
          isLoading={createCommentMutation.isPending}
          placeholder="댓글을 작성해주세요... (최대 1000자)"
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