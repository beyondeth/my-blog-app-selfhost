'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ko } from 'date-fns/locale';
import MessageItem from './MessageItem';
import { User } from '../DMLayout/DMLayout.types';

interface MessageGroup {
  senderId: string;
  messages: any[];
  timestamp: Date;
}

interface MessageListProps {
  groupedMessages: MessageGroup[];
  currentUserId: string;
  otherUser?: User;
  hasMore: boolean;
  isLoading: boolean;
  isFetchingNextPage?: boolean; // Add prop for infinite scroll state
  onLoadMore: () => Promise<void>;
  onRetry?: (messageId: string) => Promise<void>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  typingUser: string | null;
  isOtherUserInRoom?: boolean; // Track if other user is in the conversation
}

const MessageList: React.FC<MessageListProps> = ({
  groupedMessages,
  currentUserId,
  otherUser,
  hasMore,
  isLoading,
  isFetchingNextPage = false,
  onLoadMore,
  onRetry,
  messageContainerRef,
  typingUser,
  isOtherUserInRoom = false,
}) => {
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  // Format date divider
  const formatDateDivider = (date: Date) => {
    if (isToday(date)) {
      return '오늘';
    } else if (isYesterday(date)) {
      return '어제';
    } else {
      return format(date, 'yyyy년 MM월 dd일', { locale: ko });
    }
  };

  // Check if should show date divider
  const shouldShowDateDivider = (currentGroup: MessageGroup, previousGroup?: MessageGroup) => {
    if (!previousGroup) return true;

    const currentDate = new Date(currentGroup.timestamp);
    const previousDate = new Date(previousGroup.timestamp);

    return (
      currentDate.getFullYear() !== previousDate.getFullYear() ||
      currentDate.getMonth() !== previousDate.getMonth() ||
      currentDate.getDate() !== previousDate.getDate()
    );
  };

  // Intersection observer for infinite scroll
  useEffect(() => {
    // Prevent loading if already loading or no more messages
    if (!hasMore || isLoading || isFetchingNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Only load if intersecting AND not currently fetching
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          onLoadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px' // Start loading 100px before reaching the trigger
      }
    );

    if (loadMoreTriggerRef.current) {
      observer.observe(loadMoreTriggerRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, isLoading, isFetchingNextPage, onLoadMore]);

  return (
    <div
      ref={messageContainerRef}
      className="
        flex-1
        overflow-y-auto
        px-4
        py-4
        space-y-6
        bg-gradient-to-b
        from-gray-50/30
        to-white
      "
      style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#CBD5E0 #F7FAFC',
      }}
    >
      {/* Load more trigger */}
      {hasMore && (
        <div ref={loadMoreTriggerRef} className="text-center py-2">
          {isLoading && (
            <div className="text-sm text-gray-500">이전 메시지 불러오는 중...</div>
          )}
        </div>
      )}

      {/* Empty state */}
      {groupedMessages.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="w-10 h-10 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
              />
            </svg>
          </div>
          <p className="text-lg font-medium text-gray-700">대화를 시작하세요</p>
          <p className="text-sm text-gray-500 mt-1">{otherUser?.username}님에게 메시지를 보내보세요</p>
        </div>
      )}

      {/* Message groups */}
      {groupedMessages.map((group, groupIndex) => {
        const isOwnMessage = group.senderId === currentUserId;
        const previousGroup = groupIndex > 0 ? groupedMessages[groupIndex - 1] : undefined;
        const showDateDivider = shouldShowDateDivider(group, previousGroup);

        return (
          <div key={`group-${groupIndex}`}>
            {/* Date divider */}
            {showDateDivider && (
              <div className="flex items-center my-4">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="px-3 text-xs text-gray-500 font-medium">
                  {formatDateDivider(group.timestamp)}
                </span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            )}

            {/* Message group */}
            <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} mb-4`}>
              <div className={`flex items-end gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                {/* Messages */}
                <div className="space-y-1">
                  {group.messages.map((message, messageIndex) => {
                    // Check if this is the very last message in the entire conversation
                    const isLastMessageInConversation =
                      groupIndex === groupedMessages.length - 1 &&
                      messageIndex === group.messages.length - 1;

                    return (
                      <MessageItem
                        key={message.id}
                        message={message}
                        isOwnMessage={isOwnMessage}
                        onRetry={onRetry}
                        showAvatar={!isOwnMessage && messageIndex === 0}
                        isFirstInGroup={messageIndex === 0}
                        isLastInGroup={messageIndex === group.messages.length - 1}
                        isLastMessage={isLastMessageInConversation}
                        isOtherUserInRoom={isOtherUserInRoom}
                        otherUser={otherUser}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing indicator */}
      {typingUser && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-3 py-2 bg-gray-100 rounded-2xl">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;