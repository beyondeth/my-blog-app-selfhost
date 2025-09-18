'use client';

import React, { memo, useMemo, useState } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Avatar } from '@/components/ui/avatar';
import { ConversationItemProps } from '../DMLayout/DMLayout.types';
import { LogOut } from 'lucide-react';
import { useDMStore } from '@/stores/dmStore';
import ConfirmModal from '../ConfirmModal';

const ConversationItem: React.FC<ConversationItemProps> = memo(({
  conversation,
  currentUserId,
  isActive,
  onClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const { leaveConversation } = useDMStore();
  // Get the other user in the conversation
  const otherUser = useMemo(() => {
    return conversation.user1Id === currentUserId
      ? conversation.user2
      : conversation.user1;
  }, [conversation, currentUserId]);

  // Format the timestamp
  const formatTimestamp = useMemo(() => {
    if (!conversation.lastMessageAt) return '';

    const messageDate = new Date(conversation.lastMessageAt);
    const now = new Date();
    const diffInMinutes = (now.getTime() - messageDate.getTime()) / (1000 * 60);

    if (diffInMinutes < 1) {
      return '방금';
    } else if (diffInMinutes < 60) {
      return `${Math.floor(diffInMinutes)}분 전`;
    } else if (isToday(messageDate)) {
      return format(messageDate, 'HH:mm');
    } else if (isYesterday(messageDate)) {
      return '어제';
    } else if (diffInMinutes < 10080) { // Within a week
      return formatDistanceToNow(messageDate, { addSuffix: true, locale: ko });
    } else {
      return format(messageDate, 'MM/dd');
    }
  }, [conversation.lastMessageAt]);

  // Truncate message preview
  const messagePreview = useMemo(() => {
    if (!conversation.lastMessage) {
      return '대화를 시작하세요';
    }

    const content = conversation.lastMessage.content;
    const maxLength = 50;

    if (content.length <= maxLength) {
      return content;
    }

    return `${content.slice(0, maxLength)}...`;
  }, [conversation.lastMessage]);

  const handleLeaveClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering onClick
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    setIsLeaving(true);
    try {
      await leaveConversation(conversation.id);
      setShowLeaveModal(false);
    } catch (error) {
      console.error('Error leaving conversation:', error);
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <>
      <div
        onClick={() => onClick(conversation.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      className={`
        relative
        flex
        items-center
        gap-3
        p-3
        rounded-xl
        cursor-pointer
        transition-all
        duration-200
        ${isActive
          ? 'bg-blue-50 border-l-4 border-blue-500'
          : 'hover:bg-gray-50'
        }
      `}
    >
      {/* Avatar with online status */}
      <div className="relative flex-shrink-0">
        <Avatar
          src={otherUser?.profileImage}
          fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
          size="md"
          className="ring-2 ring-white"
        />
        {otherUser?.isOnline && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 truncate">
            {otherUser?.username || 'Unknown User'}
          </h3>
          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
            {formatTimestamp}
          </span>
        </div>

        {/* Message preview */}
        <div className="flex items-center justify-between">
          <p className={`
            text-sm
            truncate
            ${(conversation.unreadCount || 0) > 0
              ? 'text-gray-900 font-medium'
              : 'text-gray-500'
            }
          `}>
            {messagePreview}
          </p>

          {/* Unread count badge - 카카오톡 스타일 */}
          {(conversation.unreadCount || 0) > 0 && (
            <span className="
              flex-shrink-0
              ml-2
              min-w-[20px]
              h-5
              px-1.5
              bg-red-500
              text-white
              text-xs
              font-bold
              rounded-full
              flex
              items-center
              justify-center
            ">
              {(conversation.unreadCount || 0) > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>

      {/* Leave button - shown on hover */}
      {isHovered && (
        <button
          onClick={handleLeaveClick}
          className="
            absolute
            right-2
            top-1/2
            -translate-y-1/2
            p-2
            rounded-lg
            bg-gray-100
            text-gray-600
            hover:bg-gray-200
            hover:text-gray-800
            transition-all
            duration-200
          "
          title="대화방 나가기"
        >
          <LogOut className="w-4 h-4" />
        </button>
      )}
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
  </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for performance
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.conversation.lastMessageAt === nextProps.conversation.lastMessageAt &&
    prevProps.conversation.unreadCount === nextProps.conversation.unreadCount
  );
});

ConversationItem.displayName = 'ConversationItem';

export default ConversationItem;