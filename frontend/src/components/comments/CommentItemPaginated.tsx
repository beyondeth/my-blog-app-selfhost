'use client';

import { useState } from 'react';
import { FiThumbsUp, FiThumbsDown, FiChevronRight, FiMoreVertical, FiEdit3, FiTrash2, FiFlag, FiCheckCircle, FiMessageCircle } from 'react-icons/fi';
import { useQueryClient } from '@tanstack/react-query';
import type { Comment } from '@/types';
import { useAuth } from '@/providers/AuthProviderV2';
import { Avatar } from '@/components/ui/avatar';
import {
  useRepliesPaginated,
  useToggleCommentLikePaginated,
  useToggleCommentDislikePaginated,
  flattenPaginatedComments,
  useDeleteCommentPaginated,
  useCreateCommentPaginated,
} from '@/hooks/useCommentsPaginated';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { formatRelativeTime } from '@/utils/timeFormat';
import CommentForm from './CommentForm';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';
import DeleteConfirmDialog from '@/components/ui/DeleteConfirmDialog';
import { apiClient } from '@/lib/api';

// 답글 아이템 컴포넌트
interface ReplyItemProps {
  reply: Comment;
  user: any;
  postId: string;
  likeMutation: any;
  dislikeMutation: any;
  deleteMutation: any;
  createReplyMutation: any;
  refetchReplies: () => void;
  openReportModal: () => void;
  parentCommentId: string;
  replyingToId: string | null;
  setReplyingToId: (id: string | null) => void;
}

function ReplyItem({
  reply,
  user,
  postId,
  likeMutation,
  dislikeMutation,
  deleteMutation,
  createReplyMutation,
  refetchReplies,
  openReportModal,
  parentCommentId,
  replyingToId,
  setReplyingToId,
}: ReplyItemProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isAuthor = user?.id === reply.author.id;

  return (
    <div className="ml-8 py-2">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <Avatar
            src={reply.author.profileImage}
            alt={reply.author.username || '익명'}
            fallback={reply.author.username || '익명'}
            size="xs"
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Author and metadata */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-xs text-gray-500 dark:text-gray-500">
                {reply.author.username || '익명'}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-600">
                {formatRelativeTime(reply.createdAt)}
              </span>
            </div>

            {/* Dropdown menu */}
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="p-1 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
              >
                <FiMoreVertical className="w-4 h-4" />
              </button>

              {showDropdown && (
                <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                  {isAuthor && (
                    <>
                      <button
                        onClick={() => {
                          setIsEditing(true);
                          setShowDropdown(false);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiEdit3 className="w-4 h-4 mr-2" />
                        수정
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('답글을 삭제하시겠습니까?')) {
                            await deleteMutation.mutateAsync(reply.id);
                            refetchReplies();
                          }
                          setShowDropdown(false);
                        }}
                        className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <FiTrash2 className="w-4 h-4 mr-2" />
                        삭제
                      </button>
                    </>
                  )}
                  {!isAuthor && (
                    <button
                      onClick={() => {
                        openReportModal();
                        setShowDropdown(false);
                      }}
                      className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <FiFlag className="w-4 h-4 mr-2" />
                      신고
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Content or Edit form */}
          {isEditing ? (
            <CommentForm
              postId={postId}
              initialValue={reply.content}
              onSubmit={async (content) => {
                try {
                  await apiClient.updateComment(reply.id, content);
                  setIsEditing(false);
                  refetchReplies();
                } catch (error) {
                  console.error('답글 수정 실패:', error);
                }
              }}
              onCancel={() => setIsEditing(false)}
              isLoading={false}
              placeholder="답글을 수정하세요..."
              submitText="수정"
              maxLength={1000}
            />
          ) : (
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
              {reply.content}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={() => likeMutation.mutate(reply.id)}
              disabled={likeMutation.isPending}
              className={`flex items-center gap-1 text-xs transition-colors ${
                reply.userLiked
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <FiThumbsUp className={`w-4 h-4 ${reply.userLiked ? 'fill-current' : ''}`} />
              <span>{reply.likesCount || 0}</span>
            </button>

            <button
              onClick={() => dislikeMutation.mutate(reply.id)}
              disabled={dislikeMutation.isPending}
              className={`flex items-center gap-1 text-xs transition-colors ${
                reply.userDisliked
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
            >
              <FiThumbsDown className={`w-4 h-4 ${reply.userDisliked ? 'fill-current' : ''}`} />
              <span>{reply.dislikesCount || 0}</span>
            </button>

            {/* Reply button */}
            {user && (
              <button
                onClick={() => setReplyingToId(replyingToId === reply.id ? null : reply.id)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  replyingToId === reply.id
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <FiMessageCircle className="w-4 h-4" />
                답글
              </button>
            )}
          </div>

          {/* Reply form */}
          {replyingToId === reply.id && (
            <div className="mt-3">
              <CommentForm
                postId={postId}
                onSubmit={async (content) => {
                  // @멘션 자동 추가
                  const finalContent = `@${reply.author.username} ${content}`;
                  try {
                    await createReplyMutation.mutateAsync({
                      content: finalContent,
                      postId: postId,
                      parentCommentId: reply.id, // 실제 부모는 답글
                    });
                    setReplyingToId(null);
                    // 답글 목록 새로고침
                    await refetchReplies();
                  } catch (error) {
                    console.error('답글 작성 실패:', error);
                  }
                }}
                onCancel={() => setReplyingToId(null)}
                isLoading={createReplyMutation.isPending}
                placeholder={`@${reply.author.username}에게 답글...`}
                submitText="답글 작성"
                maxLength={1000}
                autoFocus={true}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface CommentItemPaginatedProps {
  comment: Comment;
  postId: string;
  postAuthorId?: string;
  level?: number; // 0 = parent, 1+ = reply
  rootParentId?: string; // 최상위 부모 댓글 ID (플랫 구조용)
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
  rootParentId,
}: CommentItemPaginatedProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 답글 상태를 localStorage나 sessionStorage에 저장하여 유지
  const repliesStateKey = `replies_open_${comment.id}`;
  const [showReplies, setShowReplies] = useState(() => {
    // 세션 스토리지에서 상태 복원
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(repliesStateKey) === 'true';
    }
    return false;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  // 각 답글에 대한 답글 폼 상태 관리
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();

  // 답글 페이지네이션 (lazy-load) - level 0만 직접 로드
  const {
    data: repliesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchReplies,
  } = useRepliesPaginated(
    comment.id,
    { limit: 20 },
    { enabled: showReplies && level === 0 }, // 부모 댓글만 답글 로드
  );

  // 좋아요/싫어요 mutations
  const likeMutation = useToggleCommentLikePaginated(postId);
  const dislikeMutation = useToggleCommentDislikePaginated(postId);
  const deleteMutation = useDeleteCommentPaginated(postId);
  // 항상 최상위 부모 댓글 ID를 사용
  const parentIdForMutation = level === 0 ? comment.id : (rootParentId || comment.parentCommentId);
  const createReplyMutation = useCreateCommentPaginated(postId, parentIdForMutation);

  // useInfiniteQuery는 { pages: [...] } 구조를 반환
  const flatReplies = flattenPaginatedComments(repliesData);
  const totalReplies = comment.repliesCount || 0;

  const isPostAuthor = comment.author.id === postAuthorId;

  // 답글 중에 작성자가 쓴 댓글이 있는지 확인
  // 플랫 구조에서 모든 답글이 로드되므로 정확한 확인 가능
  const hasAuthorReply = postAuthorId && flatReplies.some(reply => reply.author.id === postAuthorId);
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
    // 답글을 숨길 때만 스크롤 위치 유지 (펼칠 때는 자연스럽게)
    if (showReplies) {
      // 현재 댓글의 위치를 저장
      const currentScrollY = window.scrollY;

      // 답글 숨기기
      setShowReplies(false);
      sessionStorage.removeItem(repliesStateKey);

      // 다음 프레임에서 스크롤 위치 복원
      requestAnimationFrame(() => {
        window.scrollTo(0, currentScrollY);
      });
    } else {
      setShowReplies(true);
      sessionStorage.setItem(repliesStateKey, 'true');
    }
  };

  const handleReply = async (content: string) => {
    // 답글의 답글인 경우 @username 추가
    const finalContent = level >= 1
      ? `@${comment.author.username} ${content}`
      : content;

    try {
      await createReplyMutation.mutateAsync({
        content: finalContent,
        postId: postId,
        parentCommentId: comment.id, // 실제 부모 댓글의 ID
      });

      setIsReplying(false);

      // 부모 댓글(level 0)에 답글을 단 경우
      if (level === 0) {
        // 답글 섹션이 닫혀있으면 자동으로 열기
        if (!showReplies) {
          setShowReplies(true);
          sessionStorage.setItem(repliesStateKey, 'true');
        }
        // 답글 목록 새로고침
        await refetchReplies();
      }
    } catch (error) {
      console.error('답글 작성 실패:', error);
    }
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
    <div className={`${level === 0 ? 'py-4 border-b border-gray-100 dark:border-gray-800' : 'py-2 ml-8'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 relative">
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
            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words mb-4">
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

            {/* Reply Button (답글 작성 버튼) */}
            {user && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className={`flex items-center gap-1 text-xs transition-colors ${
                  isReplying
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-500 dark:text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'
                }`}
              >
                <FiMessageCircle className="w-4 h-4" />
                답글
              </button>
            )}
          </div>

          {/* Reply Form (답글 작성 폼) */}
          {isReplying && (
            <div className="mt-4 ml-12">
              <CommentForm
                postId={postId}
                onSubmit={handleReply}
                onCancel={() => setIsReplying(false)}
                isLoading={createReplyMutation.isPending}
                placeholder={level >= 1 ? `@${comment.author.username}에게 답글...` : "답글을 작성해주세요..."}
                submitText="답글 작성"
                maxLength={1000}
                autoFocus={true}
              />
            </div>
          )}

          {/* Reply Count (부모 댓글에서만 표시) */}
          {level === 0 && totalReplies > 0 && (
            <div className="flex items-center gap-1 mt-6">
              {/* 작성자가 답글을 단 경우 프로필 표시 - 답글 로드 여부와 무관 */}
              {hasAuthorReply && !showReplies && (
                <>
                  <div className="w-6 h-6 rounded-full bg-gray-800 dark:bg-gray-200 flex items-center justify-center">
                    <FiCheckCircle className="w-3.5 h-3.5 text-white dark:text-gray-900" />
                  </div>
                  <span className="text-gray-400 dark:text-gray-600">·</span>
                </>
              )}
              <button
                onClick={handleToggleReplies}
                className="flex items-center gap-0.5 text-xs text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 font-semibold transition-colors relative comment-reply-button"
              >
                {showReplies ? '답글 숨기기' : `답글 ${totalReplies}개`}
                <FiChevronRight className={`w-4 h-4 transition-transform ${showReplies ? 'rotate-90' : ''}`} />
              </button>
            </div>
          )}

          {/* Replies (부모 댓글에서만 표시, 플랫 구조) */}
          {level === 0 && showReplies && (
            <div className="mt-4 space-y-2">
              {/* 모든 답글을 플랫하게 표시 (동일한 레벨) */}
              {flatReplies.map((reply) => (
                <ReplyItem
                  key={reply.id}
                  reply={reply}
                  user={user}
                  postId={postId}
                  likeMutation={likeMutation}
                  dislikeMutation={dislikeMutation}
                  deleteMutation={deleteMutation}
                  createReplyMutation={createReplyMutation}
                  refetchReplies={refetchReplies}
                  openReportModal={() => openReportModal(
                    'comment',
                    reply.id,
                    reply.author.username || '익명'
                  )}
                  parentCommentId={comment.id}
                  replyingToId={replyingToId}
                  setReplyingToId={setReplyingToId}
                />
              ))}

              {/* Load More Replies */}
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 ml-8"
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
