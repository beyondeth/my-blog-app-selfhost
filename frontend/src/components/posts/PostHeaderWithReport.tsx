'use client';

import { useState, useCallback } from 'react';
import { FiUser, FiCalendar, FiEye, FiTag, FiArrowLeft, FiEdit3, FiTrash2, FiHeart, FiShare2, FiMoreVertical, FiFlag, FiBookmark, FiUpload, FiMessageCircle, FiTarget, FiPlus, FiMinus, FiLock, FiGlobe } from 'react-icons/fi';
import { Post } from '@/types';
import { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';
import { useAuth } from '@/providers/AuthProviderV2';
import RelativeTime from '@/components/ui/RelativeTime';
import FollowButton from '@/components/FollowButton';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';
import { useMobileOverlayReset } from '@/hooks/useMobileOverlayReset';

interface PostHeaderWithReportProps {
  post: Post;
  canEdit?: boolean;
  onBack?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  liked?: boolean;
  likeCount?: number;
  onLike?: () => void;
  onShare?: () => void;
  onCopy?: () => void;
  onBookmark?: () => void;
  bookmarked?: boolean;
  bookmarkPending?: boolean;
  isAdmin?: boolean;
  isEditorPick?: boolean;
  onToggleEditorPick?: () => void;
  editorPickPending?: boolean;
  visibility?: 'public' | 'private';
  onToggleVisibility?: () => void;
  visibilityPending?: boolean;
  visibilityToggleDisabled?: boolean;
  visibilityToggleDisabledReason?: string;
  LikeButtonComponent?: ReactNode;
}

export default function PostHeaderWithReport({
  post,
  canEdit = false,
  onBack,
  onEdit,
  onDelete,
  liked = false,
  likeCount = 0,
  onLike,
  onShare,
  onCopy,
  onBookmark,
  bookmarked = false,
  bookmarkPending = false,
  isAdmin = false,
  isEditorPick = false,
  onToggleEditorPick,
  editorPickPending = false,
  visibility = 'public',
  onToggleVisibility,
  visibilityPending = false,
  visibilityToggleDisabled = false,
  visibilityToggleDisabledReason,
  LikeButtonComponent
}: PostHeaderWithReportProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();
  const { user } = useAuth();
  const closeDropdown = useCallback(() => setShowDropdown(false), []);
  const actionButtonBase =
    'flex items-center px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  const neutralActionButton =
    'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-100';
  const dangerActionButton =
    'border-gray-300 bg-white text-gray-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300 dark:hover:border-red-900/70 dark:hover:bg-red-950/30 dark:hover:text-red-300';

  useMobileOverlayReset(closeDropdown, showDropdown);

  // Check if current user is the post author
  const isAuthor = user?.id === post.author?.id;
  const displayProfileImage = isAuthor ? user?.profileImage : post.author?.profileImage;

  const handleReport = () => {
    if (!user) return; // 로그인하지 않은 경우 실행 안 함
    openReportModal('post', post.id, post.title);
    setShowDropdown(false);
  };

  // 댓글 섹션으로 스크롤
  const handleScrollToComments = () => {
    const commentsSection = document.querySelector('[data-comment-section]');
    if (commentsSection) {
      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <header className="mb-8">
        {/* Back Button */}
        {onBack && (
          <div className="mb-6">
            <button
              onClick={onBack}
              className="inline-flex items-center rounded-full border border-gray-200 px-4 py-1.5 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white dark:border-white/25 transition-colors text-xs font-semibold shadow-sm bg-white/60 dark:bg-white/5 backdrop-blur-sm"
            >
              <FiArrowLeft className="w-4 h-4 mr-2" />
              Back
            </button>
          </div>
        )}

        {/* Category - 제목 위 독립된 줄 */}
        {post.category && (
          <div className="mb-3">
            <span className="inline-flex items-center text-[13px] text-gray-700 dark:text-gray-300 font-medium gap-1">
              <FiTag className="w-4 h-4" />
              <span>{post.category}</span>
            </span>
          </div>
        )}

        {/* Title - 전체 너비 차지 */}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
          {post.title || ''}
        </h1>

        {/* Author Profile with Follow Button and Post Date */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          {/* 왼쪽 그룹: 프로필, 팔로우, 날짜, 에디터픽 */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 프로필 이미지 + 유저네임 - 툴팁 포함 */}
            {post.author?.id ? (
              <UserLinkWithTooltip
                userId={post.author.id}
                username={post.author.username || 'Author'}
                blogSlug={post.blog?.slug}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={displayProfileImage}
                    alt={post.author?.username || 'Author'}
                    fallback={post.author?.username || 'Author'}
                    size="md"
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {post.author?.username || 'Author'}
                  </span>
                </div>
              </UserLinkWithTooltip>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar
                  src={displayProfileImage}
                  alt={post.author?.username || 'Author'}
                  fallback={post.author?.username || 'Author'}
                  size="md"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {post.author?.username || 'Author'}
                </span>
              </div>
            )}

            {/* Follow 버튼 */}
            {post.author?.id && (
              <FollowButton userId={post.author.id} variant="minimal" className="ml-1" />
            )}

            {/* 작성시간 */}
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mr-2">
              <span className="mx-2">·</span>
              <RelativeTime date={post.publishedAt || post.createdAt} />
            </div>

            {/* Editor's Pick 버튼 (Admin 전용) 또는 배지 */}
            {isAdmin && onToggleEditorPick ? (
              <button
                onClick={onToggleEditorPick}
                disabled={editorPickPending}
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-all border ${
                  isEditorPick
                    ? 'bg-red-500 text-white border-red-600 hover:bg-red-600 dark:bg-red-600 dark:border-red-700 dark:hover:bg-red-700'
                    : 'bg-green-500 text-white border-green-600 hover:bg-green-600 dark:bg-green-600 dark:border-green-700 dark:hover:bg-green-700'
                } ${editorPickPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isEditorPick ? 'Editor\'s Pick에서 제거' : 'Editor\'s Pick에 추가'}
              >
                {editorPickPending ? (
                  <>
                    <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    처리 중
                  </>
                ) : isEditorPick ? (
                  <>
                    <FiMinus className="w-4 h-4 mr-1" />
                    Remove Pick
                  </>
                ) : (
                  <>
                    <FiPlus className="w-4 h-4 mr-1" />
                    Add Pick
                  </>
                )}
              </button>
            ) : isEditorPick ? (
              <div className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600">
                <FiTarget className="w-5 h-5 mr-1" />
                Pick
              </div>
            ) : null}
          </div>

          {/* 오른쪽 그룹: 수정/삭제 버튼 - 작성자 전용 */}
          {canEdit && onEdit && onDelete && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center space-x-3">
                <button
                  onClick={onEdit}
                  className={`${actionButtonBase} ${neutralActionButton}`}
                  title="수정"
                >
                  <FiEdit3 className="mr-1 w-3 h-3" />
                  수정
                </button>
                {onToggleVisibility && (
                  <>
                    <button
                      onClick={onToggleVisibility}
                      disabled={visibilityPending || visibilityToggleDisabled}
                      className={`${actionButtonBase} ${neutralActionButton}`}
                      title={visibilityToggleDisabledReason || (
                        visibility === 'private'
                          ? '공개로 변경'
                          : '비공개로 변경'
                      )}
                    >
                      {visibilityPending ? (
                        <>
                          <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
                          변경 중...
                        </>
                      ) : visibility === 'private' ? (
                        <>
                          <FiGlobe className="mr-1 w-3 h-3" />
                          공개로 변경
                        </>
                      ) : (
                        <>
                          <FiLock className="mr-1 w-3 h-3" />
                          비공개로 변경
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  onClick={onDelete}
                  className={`${actionButtonBase} ${dangerActionButton}`}
                  title="삭제"
                >
                  <FiTrash2 className="mr-1 w-3 h-3" />
                  삭제
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Meta Information with Like/Share and Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600 dark:text-gray-300 mb-8 pt-2 pb-2 border-t border-b border-gray-400 dark:border-gray-500">
          {/* Left: Meta Information with Like/Share */}
          <div className="flex flex-wrap items-center gap-6 pl-1">
            {/* 뷰 - 정보 표시만 */}
            <div className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-300 font-medium">
              <FiEye className="w-5 h-5" />
              <span>{(post.viewCount || 0).toLocaleString()}</span>
            </div>

            {/* 인터랙션 그룹: 좋아요, 댓글 - 좁은 간격 */}
            <div className="flex items-center gap-3">
              {/* 좋아요 버튼 */}
              {LikeButtonComponent ? (
                LikeButtonComponent
              ) : onLike && (
                <button
                  onClick={onLike}
                  className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                    liked
                      ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/40'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
                  }`}
                >
                  <FiHeart className={`w-5 h-5 ${liked ? 'fill-current' : ''}`} />
                  <span>{likeCount}</span>
                </button>
              )}

              {/* 댓글 버튼 - 클릭 시 댓글 섹션으로 스크롤 */}
              <button
                onClick={handleScrollToComments}
                className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors font-medium"
                title="댓글 보기"
              >
                <FiMessageCircle className="w-5 h-5" />
                <span>{post.commentCount || 0}</span>
              </button>
            </div>
          </div>

          {/* Right: Share, Copy, PDF, Bookmark, More Menu */}
          <div className="flex items-center space-x-3">
            {/* 공유 버튼 */}
            {onShare && (
              <button
                onClick={onShare}
                className="flex items-center justify-center p-1 rounded-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
                title="공유"
              >
                <FiUpload className="w-5 h-5" />
              </button>
            )}

            {/* 복사 버튼 - 작성자 본인만 표시 */}
            {isAuthor && onCopy && (
              <button
                onClick={onCopy}
                className="flex items-center justify-center p-1 rounded-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 transition-colors"
                title="포스트 내용 복사"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}

            {/* 북마크 버튼 */}
            {onBookmark && (
              <button
                onClick={onBookmark}
                disabled={bookmarkPending}
                className={`flex items-center justify-center p-1 rounded-full transition-colors ${
                  bookmarkPending
                    ? 'opacity-50 cursor-not-allowed'
                    : bookmarked
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/40'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100'
                }`}
                title={bookmarkPending ? '처리 중...' : '북마크'}
              >
                <FiBookmark className={`w-5 h-5 ${bookmarked ? 'fill-current' : ''}`} />
              </button>
            )}

            {/* More Options Menu - Only show if not the author */}
            {!isAuthor && (
              <div className="relative">
                <button
                  onClick={() => {
                    if (!user) return; // 로그인하지 않은 경우 실행 안 함
                    setShowDropdown(!showDropdown);
                  }}
                  className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  title="더보기"
                >
                  <FiMoreVertical className="w-4 h-4" />
                </button>

                {showDropdown && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowDropdown(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20">
                      <button
                        onClick={handleReport}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <FiFlag className="mr-2 w-4 h-4" />
                        신고하기
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

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
    </>
  );
}
