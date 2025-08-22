"use client";

import { useState } from 'react';
import { FiUser, FiCalendar, FiEye, FiTag, FiArrowLeft, FiEdit3, FiTrash2, FiHeart, FiShare2, FiMoreVertical, FiFlag } from 'react-icons/fi';
import { Post } from '@/types';
import { ReactNode } from 'react';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';
import { useAuth } from '@/hooks/useAuth';

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
  LikeButtonComponent
}: PostHeaderWithReportProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();
  const { user } = useAuth();
  
  // Check if current user is the post author
  const isAuthor = user?.id === post.author?.id;

  const handleReport = () => {
    openReportModal('post', post.id, post.title);
    setShowDropdown(false);
  };

  return (
    <>
      <header className="mb-8">
        {/* Back Button - 컨테이너 경계를 넘어서 왼쪽에 배치 */}
        {onBack && (
          <div className="mb-6 -ml-8">
            <button
              onClick={onBack}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors text-xs font-medium"
            >
              <FiArrowLeft className="mr-2 w-4 h-4" />
              Back
            </button>
          </div>
        )}

        {/* Category */}
        {post.category && (
          <div className="mb-6">
            <span className="inline-flex items-center px-3 py-1 text-xs font-medium bg-gray-100 text-gray-900 rounded-full">
              <FiTag className="mr-1 w-3 h-3" />
              {post.category}
            </span>
          </div>
        )}
        
        {/* Title - 전체 너비 차지 */}
        <h1 className="text-base font-bold text-gray-900 mb-5 leading-[23px]">
          {post.title}
        </h1>

        {/* Meta Information with Like/Share and Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-gray-500 mb-8 pb-4 border-b border-gray-100">
          {/* Left: Meta Information with Like/Share */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center">
              <FiUser className="mr-2 w-4 h-4" />
              <span className="font-medium">{post.author?.username || 'Author'}</span>
            </div>
            <div className="flex items-center">
              <FiCalendar className="mr-2 w-4 h-4" />
              <span>{new Date(post.publishedAt || post.createdAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center">
              <FiEye className="mr-2 w-4 h-4" />
              <span>{post.viewCount.toLocaleString()} views</span>
            </div>
            
            {/* Like and Share Buttons - 뷰 바로 옆에 붙임 */}
            {LikeButtonComponent ? (
              LikeButtonComponent
            ) : onLike && (
              <button
                onClick={onLike}
                className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs transition-colors ${
                  liked 
                    ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <FiHeart className={`w-3 h-3 ${liked ? 'fill-current' : ''}`} />
                <span>{likeCount}</span>
              </button>
            )}
            
            {onShare && (
              <button
                onClick={onShare}
                className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
              >
                <FiShare2 className="w-3 h-3" />
                <span>공유</span>
              </button>
            )}
            
            {onCopy && (
              <button
                onClick={onCopy}
                className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                title="포스트 내용 복사"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span>복사</span>
              </button>
            )}
          </div>

          {/* Right: Edit/Delete Buttons and More Menu */}
          <div className="flex items-center space-x-3">
            {canEdit && onEdit && onDelete && (
              <>
                <button
                  onClick={onEdit}
                  className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="수정"
                >
                  <FiEdit3 className="mr-1 w-3 h-3" />
                  수정
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center px-2 py-1 text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  title="삭제"
                >
                  <FiTrash2 className="mr-1 w-3 h-3" />
                  삭제
                </button>
              </>
            )}
            
            {/* More Options Menu - Only show if not the author */}
            {!isAuthor && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
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
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      <button
                        onClick={handleReport}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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