"use client";

import { useState } from 'react';
import { FiUser, FiCalendar, FiEye, FiTag, FiArrowLeft, FiEdit3, FiTrash2, FiHeart, FiShare2, FiMoreVertical, FiFlag, FiBookmark, FiUpload, FiMessageCircle, FiTarget } from 'react-icons/fi';
import { BsFiletypePdf } from 'react-icons/bs';
import { Post } from '@/types';
import { ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';
import { useAuth } from '@/providers/AuthProviderV2';
import { formatRelativeTime } from '@/utils/timeFormat';
import FollowButton from '@/components/FollowButton';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';

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
  onPdfDownload?: () => void;
  onBookmark?: () => void;
  bookmarked?: boolean;
  bookmarkPending?: boolean;
  isAdmin?: boolean;
  isEditorPick?: boolean;
  onToggleEditorPick?: () => void;
  editorPickPending?: boolean;
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
  onPdfDownload,
  onBookmark,
  bookmarked = false,
  bookmarkPending = false,
  isAdmin = false,
  isEditorPick = false,
  onToggleEditorPick,
  editorPickPending = false,
  LikeButtonComponent
}: PostHeaderWithReportProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();
  const { user } = useAuth();

  // Check if current user is the post author
  const isAuthor = user?.id === post.author?.id;

  // PDF 다운로드 핸들러 - 중복 클릭 방지 및 에러 격리
  const handlePdfDownload = async () => {
    if (!onPdfDownload || isPdfGenerating) return;

    setIsPdfGenerating(true);
    try {
      await onPdfDownload();
    } catch {
      // 에러 완전 무시 - 사용자에게 알리지 않음
    } finally {
      // 3초 쿨다운
      setTimeout(() => setIsPdfGenerating(false), 3000);
    }
  };

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
        {/* Back Button과 Category를 같은 줄에 배치 */}
        {(onBack || post.category) && (
          <div className="mb-6 -ml-8 flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="inline-flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors text-xs font-medium"
              >
                <FiArrowLeft className="mr-2 w-4 h-4" />
                Back
              </button>
            )}
            {/* Category - Back 버튼 옆에 배치 */}
            {post.category && (
              <span className="inline-flex items-center text-[13px] text-gray-600 dark:text-gray-400 gap-1">
                <span>🏷️</span>
                <span>{post.category}</span>
              </span>
            )}
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
                    src={post.author?.profileImage}
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
                  src={post.author?.profileImage}
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
              <span>{formatRelativeTime(post.publishedAt || post.createdAt)}</span>
            </div>

            {/* Editor's Pick 버튼 (Admin 전용) 또는 배지 */}
            {isAdmin && onToggleEditorPick ? (
              <button
                onClick={onToggleEditorPick}
                disabled={editorPickPending}
                className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full transition-all border ${
                  isEditorPick
                    ? 'bg-gray-700 text-white border-gray-800 hover:bg-gray-800 dark:bg-gray-600 dark:border-gray-700 dark:hover:bg-gray-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-700 dark:hover:border-gray-500'
                } ${editorPickPending ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isEditorPick ? 'Pick 선정 해제' : 'Pick으로 선정'}
              >
                {editorPickPending ? (
                  <>
                    <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    처리 중
                  </>
                ) : (
                  <>
                    <FiTarget className="w-5 h-5 mr-1" />
                    Pick
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
            <div className="flex items-center space-x-3">
              <button
                onClick={onEdit}
                className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="수정"
              >
                <FiEdit3 className="mr-1 w-3 h-3" />
                수정
              </button>
              <button
                onClick={onDelete}
                className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                title="삭제"
              >
                <FiTrash2 className="mr-1 w-3 h-3" />
                삭제
              </button>
            </div>
          )}
        </div>

        {/* Meta Information with Like/Share and Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500 dark:text-gray-400 mb-8 pt-2 pb-2 border-t border-b border-gray-100 dark:border-gray-700">
          {/* Left: Meta Information with Like/Share */}
          <div className="flex flex-wrap items-center gap-6 pl-1">
            {/* 뷰 - 정보 표시만 */}
            <div className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
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
                className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
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
                className="flex items-center justify-center p-1 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                title="공유"
              >
                <FiUpload className="w-5 h-5" />
              </button>
            )}

            {/* 복사 버튼 - 작성자 본인만 표시 */}
            {isAuthor && onCopy && (
              <button
                onClick={onCopy}
                className="flex items-center justify-center p-1 rounded-full text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200 transition-colors"
                title="포스트 내용 복사"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}

            {/* PDF 다운로드 버튼 - 작성자 본인만 표시 */}
            {isAuthor && onPdfDownload && (
              <button
                onClick={handlePdfDownload}
                disabled={isPdfGenerating}
                className={`flex items-center justify-center p-1 rounded-full transition-colors ${
                  isPdfGenerating
                    ? 'text-gray-400 cursor-not-allowed opacity-50 dark:text-gray-600'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
                }`}
                title={isPdfGenerating ? "PDF 생성 중..." : "PDF로 다운로드"}
                data-pdf-hide="true"
              >
                <BsFiletypePdf className="w-5 h-5" />
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
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200'
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
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
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