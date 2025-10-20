'use client';

import React, { memo, useState } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import ConfirmModal from '../ConfirmModal';
import { Avatar } from '@/components/ui/avatar';
import { User } from '../DMLayout/DMLayout.types';
import { useDMStore } from '@/stores/dmStore';
import { useSocketManager } from '@/hooks/chat/useSocketManager';
import { SOCKET_EVENTS } from '@/constants/chat';

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
        console.log('[채팅] X 버튼 - WebSocket leave 이벤트 발생:', conversationId);
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
        {/* Back button (mobile) */}
        <button
          onClick={handleBackClick}
          className="
            p-2
            -ml-2
            rounded-lg
            hover:bg-gray-100
            transition-colors
            md:hidden
          "
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>

        {/* User info */}
        <div className="flex items-center gap-3">
          <Avatar
            src={otherUser?.profileImage}
            fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
            size="md"
            className={`ring-2 ring-white ${isLoading ? 'animate-pulse' : ''}`}
          />

          <div>
            <h2 className="font-semibold text-gray-900">
              {isLoading ? (
                <div className="h-5 bg-gray-200 rounded w-24 animate-pulse" />
              ) : (
                otherUser?.username || 'Unknown User'
              )}
            </h2>
          </div>
        </div>
      </div>

      {/* Leave button */}
      <button
        onClick={handleLeaveClick}
        className="
          p-2
          rounded-lg
          bg-gray-100
          text-gray-700
          hover:bg-gray-200
          transition-colors
        "
      >
        <LogOut className="w-5 h-5" />
      </button>

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
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';

export default ChatHeader;