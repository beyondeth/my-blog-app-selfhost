'use client';

import React, { memo, useState, useRef, useEffect } from 'react';
import ConfirmModal from '../ConfirmModal';
import { Avatar } from '@/components/ui/avatar';
import { User } from '../DMLayout/DMLayout.types';
import { useDMStore } from '@/stores/dmStore';
import { useSocketManager } from '@/hooks/chat/useSocketManager';
import { SOCKET_EVENTS } from '@/constants/chat';
import { useReport } from '@/hooks/useReport';
import { useBlock } from '@/hooks/useBlock';
import ReportDialog from '@/components/reports/ReportDialog';
import BlockConfirmDialog from '@/components/blocks/BlockConfirmDialog';
import UserLinkWithTooltip from '@/components/UserLinkWithTooltip';

interface ChatHeaderProps {
  otherUser?: User | null;
  isLoading?: boolean;
  conversationId?: string;
}

const ChatHeader: React.FC<ChatHeaderProps> = memo(({ otherUser, isLoading, conversationId }) => {
  const { setActiveConversation, setConversationListVisible, leaveConversation } = useDMStore();
  const { socket } = useSocketManager();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // 액션 버튼 표시 상태
  const [showActions, setShowActions] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  // 신고 기능
  const { isReportModalOpen, reportTarget, openReportModal, closeReportModal, submitReport, isSubmitting } = useReport();

  // 차단 기능
  const { isBlockModalOpen, blockTarget, openBlockModal, closeBlockModal, blockUser, isBlocking } = useBlock();

  // 외부 클릭 감지 - 액션 버튼 숨기기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        setShowActions(false);
      }
    };

    if (showActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActions]);

  const handleBackClick = () => {
    setActiveConversation(null);
    setConversationListVisible(true);
  };



  const handleLeaveClick = () => {
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    if (!conversationId) return;

    setIsLeaving(true);
    try {
      // WebSocket으로 먼저 leave 이벤트 발생
      if (socket) {
        socket.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, conversationId);
      }

      // 그 다음 HTTP DELETE 요청
      await leaveConversation(conversationId);
      setShowLeaveModal(false);
      // Navigate back to conversation list
      setActiveConversation(null);
      setConversationListVisible(true);
    } catch (error) {
      console.error('Failed to leave conversation:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  // 신고하기 핸들러
  const handleReport = () => {
    if (!otherUser) return;
    setShowActions(false);
    openReportModal('user', otherUser.id, otherUser.username);
  };

  // 차단하기 핸들러
  const handleBlock = () => {
    if (!otherUser) return;
    setShowActions(false);
    openBlockModal(otherUser.id, otherUser.username);
  };

  // 아바타 클릭 핸들러
  const handleAvatarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowActions(!showActions);
  };

  return (
    <div className="
      flex
      items-center
      justify-between
      px-4
      py-3
      bg-white
      border-b
      border-gray-200
      shadow-sm
    ">
      <div className="flex items-center gap-3">
        {/* Back button (mobile) - 대화목록 버튼 */}
        <button
          onClick={handleBackClick}
          className="
            px-3
            py-1.5
            rounded-lg
            bg-gray-100
            text-gray-700
            hover:bg-gray-200
            transition-colors
            text-sm
            font-medium
            md:hidden
          "
          aria-label="Back to conversations"
        >
          대화목록
        </button>

        {/* User info */}
        <div className="flex items-center gap-3 relative" ref={actionsRef}>
          {/* 프로필 이미지 - 블로그 링크로 이동 */}
          {otherUser && (
            <UserLinkWithTooltip
              userId={otherUser.id}
              username={otherUser.username || ''}
            >
              <Avatar
                src={otherUser?.profileImage}
                fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
                size="md"
                className={`ring-2 ring-white ${isLoading ? 'animate-pulse' : ''}`}
              />
            </UserLinkWithTooltip>
          )}

          <div>
            <h2 className="font-semibold text-gray-900">
              {isLoading ? (
                <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
              ) : (
                otherUser?.username || 'Unknown User'
              )}
            </h2>
          </div>

          {/* 클릭 시 표시되는 액션 버튼 */}
          {showActions && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1 z-[100] min-w-[100px]">
              <button
                onClick={handleReport}
                type="button"
                className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                신고하기
              </button>
              <button
                onClick={handleBlock}
                type="button"
                className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                차단하기
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 오른쪽 버튼들 */}
      <div className="flex items-center gap-3">
        {/* 더보기 버튼 (kebab) */}
        <button
          onClick={handleAvatarClick}
          className="p-1 border-0 bg-transparent cursor-pointer rounded-lg hover:bg-gray-100 transition-colors"
          type="button"
          aria-label="더보기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-gray-600">
            <circle cx="12" cy="5" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            <circle cx="12" cy="19" r="1.5" fill="currentColor"/>
          </svg>
        </button>

        {/* 나가기 버튼 */}
        <button
          onClick={handleLeaveClick}
          className="
            px-4
            py-2
            rounded-lg
            bg-gray-100
            text-gray-700
            hover:bg-gray-200
            transition-colors
            text-sm
            font-medium
            min-h-[44px]
          "
        >
          나가기
        </button>
      </div>

      {/* Leave Confirmation Modal */}
      <ConfirmModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onConfirm={handleConfirmLeave}
        title="대화방 나가기"
        message="대화 내용이 사라집니다. 진행하시겠습니까?"
        confirmText="나가기"
        cancelText="취소"
        isLoading={isLeaving}
      />

      {/* Report Dialog - Radix UI Dialog 기반 */}
      <ReportDialog
        open={isReportModalOpen}
        onOpenChange={(open) => {
          if (!open) closeReportModal();
        }}
        onSubmit={submitReport}
        targetTitle={reportTarget?.targetTitle}
        targetType="user"
        isSubmitting={isSubmitting}
      />

      {/* Block Confirmation Dialog - Radix UI Dialog 기반 */}
      <BlockConfirmDialog
        open={isBlockModalOpen}
        onOpenChange={(open) => {
          if (!open) closeBlockModal();
        }}
        onConfirm={blockUser}
        username={blockTarget?.username}
        isBlocking={isBlocking}
      />
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;