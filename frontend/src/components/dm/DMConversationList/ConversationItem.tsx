'use client';

import React, { memo, useMemo } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Avatar } from '@/components/ui/avatar';
import { Conversation } from '@/types/chat';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId: string;
  isActive: boolean;
  onClick: (conversationId: string) => void;
}

const ConversationItem: React.FC<ConversationItemProps> = memo(({
  conversation,
  currentUserId,
  isActive,
  onClick,
}) => {
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

  return (
    <div
      onClick={() => onClick(conversation.id)}
      className={`
        relative
        flex
        items-center
        gap-3
        px-4
        py-3
        cursor-pointer
        transition-all
        duration-200
        w-full
        ${isActive
          ? 'bg-blue-50 border-l-4 border-blue-500 pl-3'
          : 'hover:bg-gray-50'
        }
      `}
    >
      {/* Avatar with online status */}
      <div className="relative flex-shrink-0">
        <Avatar
          src={otherUser?.profileImage}
          fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
          size="sm"
          className="ring-2 ring-white"
        />
        {otherUser?.isOnline && (
          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
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
    </div>
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