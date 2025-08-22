"use client";

import { useState } from 'react';
import { FiMoreVertical, FiFlag, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useReport } from '@/hooks/useReport';
import ReportModal from '@/components/reports/ReportModal';

interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    username: string;
    profileImage?: string;
  };
  createdAt: string;
  likesCount: number;
  dislikesCount: number;
  replies?: Comment[];
}

interface CommentItemWithReportProps {
  comment: Comment;
  currentUserId?: string;
  onEdit?: (commentId: string) => void;
  onDelete?: (commentId: string) => void;
  onReply?: (commentId: string) => void;
  onLike?: (commentId: string) => void;
  onDislike?: (commentId: string) => void;
}

export default function CommentItemWithReport({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  onReply,
  onLike,
  onDislike,
}: CommentItemWithReportProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();
  
  const isAuthor = currentUserId === comment.author.id;

  const handleReport = () => {
    const contentPreview = comment.content.length > 100 
      ? comment.content.substring(0, 100) + '...' 
      : comment.content;
    openReportModal('comment', comment.id, contentPreview);
    setShowDropdown(false);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) {
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      if (diffHours < 1) {
        const diffMinutes = Math.ceil(diffTime / (1000 * 60));
        return `${diffMinutes}분 전`;
      }
      return `${diffHours}시간 전`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  return (
    <>
      <div className="flex space-x-3">
        {/* Profile Image */}
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
            {comment.author.profileImage ? (
              <img 
                src={comment.author.profileImage} 
                alt={comment.author.username}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <span className="text-xs font-medium text-gray-600">
                {comment.author.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Comment Content */}
        <div className="flex-1">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900">
                  {comment.author.username}
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(comment.createdAt)}
                </span>
              </div>

              {/* More Options Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
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
                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                      {isAuthor ? (
                        <>
                          {onEdit && (
                            <button
                              onClick={() => {
                                onEdit(comment.id);
                                setShowDropdown(false);
                              }}
                              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              <FiEdit2 className="mr-2 w-3 h-3" />
                              수정
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => {
                                onDelete(comment.id);
                                setShowDropdown(false);
                              }}
                              className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <FiTrash2 className="mr-2 w-3 h-3" />
                              삭제
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={handleReport}
                          className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <FiFlag className="mr-2 w-3 h-3" />
                          신고
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>

          {/* Comment Actions */}
          <div className="flex items-center space-x-4 mt-2">
            {onLike && (
              <button
                onClick={() => onLike(comment.id)}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span>{comment.likesCount}</span>
              </button>
            )}
            
            {onDislike && (
              <button
                onClick={() => onDislike(comment.id)}
                className="flex items-center space-x-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                </svg>
                <span>{comment.dislikesCount}</span>
              </button>
            )}
            
            {onReply && (
              <button
                onClick={() => onReply(comment.id)}
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                답글
              </button>
            )}
          </div>

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-4 space-y-3 pl-4 border-l-2 border-gray-100">
              {comment.replies.map((reply) => (
                <CommentItemWithReport
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onLike={onLike}
                  onDislike={onDislike}
                />
              ))}
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
    </>
  );
}