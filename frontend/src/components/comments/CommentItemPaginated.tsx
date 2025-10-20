'use client';

import { useState } from 'react';
import { FiThumbsUp, FiThumbsDown, FiChevronRight, FiMoreVertical, FiEdit3, FiTrash2, FiFlag, FiCheckCircle } from 'react-icons/fi';
import type { Comment } from '@/types';
import { useAuth } from '@/providers/AuthProviderV2';
import { Avatar } from '@/components/ui/avatar';
import {
  useRepliesPaginated,
  useToggleCommentLikePaginated,
  useToggleCommentDislikePaginated,
  flattenPaginatedComments,
  useDeleteCommentPaginated,
} from '@/hooks/useCommentsPaginated';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatRelativeTime } from '@/utils/timeFormat';
import CommentForm from './CommentForm';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { apiClient } from '@/lib/api';

interface CommentItemPaginatedProps {
  comment: Comment;
  postId: string;
  postAuthorId?: string;
  level?: number; // 0 = parent, 1+ = reply
}

/**
 * 페이지네이션된 댓글 아이템
 *
 * @description
 * - 답글 lazy-load (버튼 클릭 시 로드)
 * - 답글도 무한 스크롤 지원
 * - 좋아요/싫어요 optimistic update
 */
export default function CommentItemPaginated({
  comment,
  postId,
  postAuthorId,
  level = 0,
}: CommentItemPaginatedProps) {
  const { user } = useAuth();
  const [showReplies, setShowReplies] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();

  // 답글 페이지네이션 (lazy-load)
  const {
    data: repliesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRepliesPaginated(
    comment.id,
    { limit: 10 },
    { enabled: showReplies }, // 답글 펼침 상태일 때만 fetch
  );

  // 좋아요/싫어요 mutations
  const likeMutation = useToggleCommentLikePaginated(postId);
  const dislikeMutation = useToggleCommentDislikePaginated(postId);
  const deleteMutation = useDeleteCommentPaginated(postId);

  // useInfiniteQuery는 { pages: [...] } 구조를 반환
  const flatReplies = flattenPaginatedComments(repliesData);
  const totalReplies = repliesData?.pages?.[0]?.totalCount || 0;

  const isPostAuthor = comment.author.id === postAuthorId;

  // 답글 중에 작성자가 쓴 댓글이 있는지 확인 및 작성자 정보 가져오기
  const authorReply = flatReplies.find(reply => reply.author.id === postAuthorId);
  const hasAuthorReply = !!authorReply;
  const isAuthor = user?.id === comment.author.id;
  const canEdit = isAuthor;
  const canDelete = isAuthor;

  const handleLike = () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    likeMutation.mutate(comment.id);
  };

  const handleDislike = () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    dislikeMutation.mutate(comment.id);
  };

  const handleToggleReplies = () => {
    setShowReplies(!showReplies);
  };

  const handleEdit = async (content: string) => {
    try {
      await apiClient.updateComment(comment.id, content);
      setIsEditing(false);
      // TODO: 캐시 업데이트 (현재는 페이지 새로고침이 필요할 수 있음)
    } catch (error) {
      console.error('Failed to update comment:', error);
      alert('댓글 수정에 실패했습니다.');
    }
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    setShowDropdown(false);
  };

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(comment.id);
    setIsDeleteDialogOpen(false);
  };

  const handleReport = () => {
    if (!user) return;
    const contentPreview = comment.content.length > 100
      ? comment.content.substring(0, 100) + '...'
      : comment.content;
    openReportModal('comment', comment.id, contentPreview);
    setShowDropdown(false);
  };

  if (comment.isDeleted) {
    return (
      <div className="text-gray-500 dark:text-gray-500 italic py-3">
        삭제된 댓글입니다.
      </div>
    );
  }

  return (
    <div className={`${level === 0 ? 'py-4 border-b border-gray-100 dark:border-gray-800' : 'py-2 ml-12'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar with connection line for parent comments with replies */}
        <div className={`flex-shrink-0 relative ${level === 0 && totalReplies > 0 ? 'comment-parent-avatar' : ''}`}>
          <Avatar
            src={comment.author.profileImage}
            alt={comment.author.username || '익명'}
            fallback={comment.author.username || '익명'}
            size={level === 0 ? "md" : "xs"}
            className={level === 0 ? "w-6 h-6 md:w-10 md:h-10" : ""}
          />
        </div>

        <div className="flex-1 min-w-0">
          {/* Author Info */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isPostAuthor ? (
                <div className="flex items-center gap-1 bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-900 px-1.5 py-0.5 rounded text-xs font-medium">
                  @{comment.author.username || '익명'}
                  <FiCheckCircle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <span className="font-medium text-xs text-gray-500 dark:text-gray-500">
                  {comment.author.username || '익명'}
                </span>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {formatRelativeTime(comment.createdAt)}
              </span>
            </div>

            {/* More Options Menu */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!user) return;
                  setShowDropdown(!showDropdown);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-600 dark:hover:text-gray-400 dark:hover:bg-gray-700 rounded transition-colors"
                title="더보기"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>

              {showDropdown && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowDropdown(false)}
                  />

                  {/* Dropdown Menu */}
                  <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                    {isAuthor ? (
                      <>
                        {/* Edit & Delete for own comments */}
                        {canEdit && (
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setShowDropdown(false);
                            }}
                            disabled={deleteMutation.isPending}
                            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            <FiEdit3 className="mr-2 w-3 h-3" />
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={handleDeleteClick}
                            disabled={deleteMutation.isPending}
                            className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                          >
                            <FiTrash2 className="mr-2 w-3 h-3" />
                            삭제
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {/* Report for other's comments */}
                        <button
                          onClick={handleReport}
                          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <FiFlag className="mr-2 w-3 h-3" />
                          신고
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          {isEditing ? (
            <CommentForm
              postId={comment.postId}
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              isLoading={false}
              initialValue={comment.content}
              placeholder="댓글을 수정해주세요..."
              submitText="수정"
              maxLength={1000}
            />
          ) : (
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-3">
              {comment.content}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-4">
            {/* Like */}
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 text-xs transition-colors ${
                comment.userLiked
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
            >
              <FiThumbsUp className="w-4 h-4" />
              <span>{comment.likesCount || 0}</span>
            </button>

            {/* Dislike */}
            <button
              onClick={handleDislike}
              className={`flex items-center gap-1 text-xs transition-colors ${
                comment.userDisliked
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400'
              }`}
            >
              <FiThumbsDown className="w-4 h-4" />
              <span>{comment.dislikesCount || 0}</span>
            </button>

            {/* Reply (부모 댓글에만 표시) */}
            {level === 0 && totalReplies > 0 && (
              <div className="flex items-center gap-1 ml-16">
                {/* 작성자가 답글을 단 경우 프로필 이미지 표시 */}
                {hasAuthorReply && authorReply && (
                  <>
                    <Avatar
                      src={authorReply.author.profileImage}
                      alt="작성자"
                      fallback="작성자"
                      size="xs"
                      className="w-6 h-6"
                    />
                    <span className="text-gray-400 dark:text-gray-600">·</span>
                  </>
                )}
                <button
                  onClick={handleToggleReplies}
                  className="flex items-center gap-0.5 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-semibold transition-colors relative comment-reply-button"
                >
                  답글 {totalReplies}개
                  <FiChevronRight className={`w-4 h-4 transition-transform ${showReplies ? 'rotate-90' : ''}`} />
                </button>
              </div>
            )}
          </div>

          {/* Replies (Lazy-loaded) */}
          {level === 0 && showReplies && (
            <div className="mt-4 space-y-2">
              {flatReplies.map((reply) => (
                <CommentItemPaginated
                  key={reply.id}
                  comment={reply}
                  postId={postId}
                  postAuthorId={postAuthorId}
                  level={level + 1}
                />
              ))}

              {/* Load More Replies */}
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 ml-12"
                >
                  {isFetchingNextPage ? <LoadingSpinner /> : '답글 더 보기'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {isReportModalOpen && reportTarget && (
        <ReportModal
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          onSubmit={submitReport}
          targetTitle={reportTarget.targetTitle}
          targetType={reportTarget.type}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="댓글을 삭제하시겠어요?"
        description="이 댓글을 삭제하면 복원할 수 없습니다."
        confirmText="삭제"
        cancelText="취소"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
