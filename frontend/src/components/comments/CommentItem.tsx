'use client';

import { useState, useMemo } from 'react';
import { FiEdit3, FiTrash2, FiMessageCircle, FiThumbsUp, FiThumbsDown, FiChevronRight, FiUser, FiMoreVertical, FiFlag, FiCheckCircle } from 'react-icons/fi';
import type { Comment } from '@/types';
import { useAuth } from '@/providers/AuthProviderV2';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import CommentForm from './CommentForm';
import { useCommentStore } from '@/contexts/CommentContext';
import { useToggleCommentLike, useToggleCommentDislike } from '@/hooks/useComments';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { formatRelativeTime } from '@/utils/timeFormat';

interface CommentItemProps {
  comment: Comment;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReply: (content: string, parentId: string) => void;
  isLoading?: boolean;
  level?: number; // 0 = main comment, 1 = reply, 2+ = use @mentions
  postAuthorId?: string; // Post author ID to check if comment is from post author
}

export default function CommentItem({
  comment,
  onUpdate,
  onDelete,
  onReply,
  isLoading = false,
  level = 0,
  postAuthorId
}: CommentItemProps) {
  const { user, isAdmin } = useAuth();
  const { isRepliesExpanded, toggleReplies } = useCommentStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();

  // Check if this comment is from post author
  const isPostAuthor = postAuthorId && comment.author.id === postAuthorId;
  
  // Like/Dislike mutations
  const likeMutation = useToggleCommentLike(comment.postId);
  const dislikeMutation = useToggleCommentDislike(comment.postId);
  
  // 전역 상태에서 답글 펼침 상태 가져오기
  const showReplies = isRepliesExpanded(comment.id);

  const canEdit = user && (user.id === comment.author.id || isAdmin);
  const canDelete = user && (user.id === comment.author.id || isAdmin);
  const isAuthor = user?.id === comment.author.id;

  // Content display logic - 200 char limit
  const isLongContent = comment.content.length > 200;
  const displayContent = isExpanded || !isLongContent 
    ? comment.content 
    : comment.content.slice(0, 200) + '...';

  // Reply management - 부모 댓글에서만 전체 답글 수 계산
  const { visibleReplies, totalReplies, flatReplies } = useMemo(() => {
    const directReplies = comment.replies?.filter(reply => !reply.isDeleted) || [];

    // 모든 답글을 플랫하게 변환 (재귀적으로)
    const flattenReplies = (replies: Comment[]): Comment[] => {
      const result: Comment[] = [];
      replies.forEach(reply => {
        if (!reply.isDeleted) {
          result.push(reply);
          result.push(...flattenReplies(reply.replies || []));
        }
      });
      return result;
    };

    // L0(부모) 댓글인 경우: 모든 하위 답글 플랫하게 표시
    const flatList = level === 0 ? flattenReplies(directReplies) : directReplies;

    return {
      visibleReplies: showReplies ? (level === 0 ? flatList : directReplies) : [],
      totalReplies: level === 0 ? flatList.length : directReplies.length,
      flatReplies: flatList
    };
  }, [comment.replies, showReplies, level]);

  // 답글 중에 작성자가 쓴 댓글이 있는지 확인 및 작성자 정보 가져오기
  const authorReply = useMemo(() => {
    if (!postAuthorId || level !== 0) return null;
    return flatReplies.find(reply => reply.author.id === postAuthorId);
  }, [flatReplies, postAuthorId, level]);

  const hasAuthorReply = !!authorReply;

  // Extract @mentions from content for L2+ replies
  const extractMentions = (content: string) => {
    const mentions = content.match(/@[\w가-힣]+/g) || [];
    return mentions;
  };

  const handleEdit = (content: string) => {
    onUpdate(comment.id, content);
    setIsEditing(false);
  };

  const handleReply = (content: string) => {
    // For L2+ replies, automatically add @mention
    const finalContent = level >= 1 
      ? `@${comment.author.username} ${content}`
      : content;
    onReply(finalContent, comment.id);
    setIsReplying(false);
  };

  const handleDeleteClick = () => {
    setIsDeleteDialogOpen(true);
    setShowDropdown(false);
  };

  const handleDeleteConfirm = () => {
    onDelete(comment.id);
    setIsDeleteDialogOpen(false);
  };

  const handleLike = () => {
    // 중복 방지: 이미 처리 중이면 무시
    if (likeMutation.isPending) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    likeMutation.mutate(comment.id);
  };

  const handleDislike = () => {
    // 중복 방지: 이미 처리 중이면 무시
    if (dislikeMutation.isPending) {
      return;
    }

    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    dislikeMutation.mutate(comment.id);
  };

  const handleReport = () => {
    if (!user) return; // 로그인하지 않은 경우 실행 안 함
    const contentPreview = comment.content.length > 100
      ? comment.content.substring(0, 100) + '...'
      : comment.content;
    openReportModal('comment', comment.id, contentPreview);
    setShowDropdown(false);
  };

  const renderMentions = (content: string) => {
    return content.split(/(@[\w가-힣]+)/g).map((part, index) => {
      if (part.startsWith('@')) {
        return (
          <span key={index} className="text-blue-600 hover:text-blue-800 cursor-pointer">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  if (comment.isDeleted) {
    return (
      <div className="text-gray-500 dark:text-gray-500 italic py-3">
        삭제된 댓글입니다.
      </div>
    );
  }

  return (
    <div className={`${level === 0 ? 'py-4' : 'py-2'} ${level === 1 ? 'ml-11' : ''}`}>
      <div className="flex items-start gap-3">
        {/* Profile Avatar with connection line for parent comments with replies */}
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
              {/* Post Author Highlight */}
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

            {/* More Options Menu - Show for all comments */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!user) return; // 로그인하지 않은 경우 실행 안 함
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
                            disabled={isLoading}
                            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            <FiEdit3 className="mr-2 w-3 h-3" />
                            수정
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={handleDeleteClick}
                            disabled={isLoading}
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

          {/* Comment Content */}
          {isEditing ? (
            <CommentForm
              postId={comment.postId}
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              isLoading={isLoading}
              initialValue={comment.content}
              placeholder="댓글을 수정해주세요..."
              submitText="수정"
              maxLength={1000}
            />
          ) : (
            <>
              <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap mb-3">
                {renderMentions(displayContent)}
                {isLongContent && !isExpanded && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 ml-2 text-sm"
                  >
                    더보기
                  </button>
                )}
                {isLongContent && isExpanded && (
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 ml-2 text-sm"
                  >
                    접기
                  </button>
                )}
              </div>

              {/* Action Buttons - YouTube Style */}
              <div className="flex items-center gap-4 mb-3">
                {/* Like/Dislike */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLike}
                    disabled={likeMutation.isPending || dislikeMutation.isPending}
                    className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400`}
                  >
                    <FiThumbsUp className="w-4 h-4" />
                    <span className="text-xs">{comment.likesCount || 0}</span>
                  </button>

                  <button
                    onClick={handleDislike}
                    disabled={likeMutation.isPending || dislikeMutation.isPending}
                    className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400`}
                  >
                    <FiThumbsDown className="w-4 h-4" />
                    <span className="text-xs">{comment.dislikesCount || 0}</span>
                  </button>
                </div>

                {/* Reply Button */}
                <button
                  onClick={() => setIsReplying(!isReplying)}
                  className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                >
                  <FiMessageCircle className="w-4 h-4" />
                  <span className="text-xs">답글</span>
                </button>
              </div>
            </>
          )}

          {/* Reply Form */}
          {isReplying && (
            <div className="mb-4">
              <CommentForm
                postId={comment.postId}
                parentCommentId={comment.id}
                onSubmit={handleReply}
                onCancel={() => setIsReplying(false)}
                isLoading={isLoading}
                placeholder={level >= 1 ? `@${comment.author.username}에게 답글...` : "답글을 작성해주세요..."}
                submitText="답글 작성"
                maxLength={1000}
                autoFocus={true}
              />
            </div>
          )}
        </div>
      </div>

      {/* Replies Section - YouTube Style - L0(부모)에서만 표시 */}
      {totalReplies > 0 && level === 0 && (
        <div className="mt-2">
          {!showReplies ? (
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
                onClick={() => toggleReplies(comment.id)}
                className="flex items-center gap-0.5 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 text-sm font-semibold py-2 relative comment-reply-button"
              >
                답글 {totalReplies}개
                <FiChevronRight className="w-4 h-4 transition-transform" />
              </button>
            </div>
          ) : (
            <>
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
                  onClick={() => toggleReplies(comment.id)}
                  className="flex items-center gap-0.5 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 text-sm font-semibold py-2 relative comment-reply-button"
                >
                  답글 숨기기
                  <FiChevronRight className="w-4 h-4 transform rotate-90 transition-transform" />
                </button>
              </div>
              
              {visibleReplies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onUpdate={onUpdate}
                  onDelete={onDelete}
                  onReply={onReply}
                  isLoading={isLoading}
                  level={1} // 모든 답글을 L1으로 표시 (@mention으로 구분)
                  postAuthorId={postAuthorId} // 답글에도 작성자 ID 전달
                />
              ))}
            </>
          )}
        </div>
      )}

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
        isLoading={isLoading}
      />
    </div>
  );
}