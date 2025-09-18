'use client';

import React, { memo } from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Check, CheckCheck, Clock, AlertCircle, RotateCw } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { Message, User } from '../DMLayout/DMLayout.types';

interface MessageItemProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  otherUser?: User;
  onRetry?: (messageId: string) => void;
}

const MessageItem: React.FC<MessageItemProps> = memo(({
  message,
  isOwnMessage,
  showAvatar,
  isFirstInGroup,
  isLastInGroup,
  otherUser,
  onRetry,
}) => {

  // Get message status icon based on status field
  const getStatusIcon = () => {
    if (!isOwnMessage) return null;

    // Use status field if available
    if (message.status === 'sending') {
      return <Clock className="w-3 h-3 text-gray-400" />;
    } else if (message.status === 'failed') {
      return <AlertCircle className="w-3 h-3 text-red-500" />;
    } else if (message.isRead) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    } else {
      return <Check className="w-3 h-3 text-gray-400" />;
    }
  };

  // Format time
  const formatTime = (date: Date) => {
    return format(new Date(date), 'a h:mm', { locale: ko });
  };

  return (
    <div
      className={`
        flex
        items-start
        gap-2
        mb-1
        ${isOwnMessage ? 'flex-row-reverse' : ''}
      `}
    >
      {/* Avatar */}
      {!isOwnMessage && showAvatar && (
        <Avatar
          src={otherUser?.profileImage}
          fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
          size="sm"
          className="mt-0.5 flex-shrink-0"
        />
      )}
      {!isOwnMessage && !showAvatar && (
        <div className="w-8 flex-shrink-0" />
      )}

      {/* Message container */}
      <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
        {/* Username (only for other user's first message in group) */}
        {!isOwnMessage && isFirstInGroup && otherUser && (
          <span className="text-xs text-gray-600 mb-1">
            {otherUser.username}
          </span>
        )}

        {/* Message and time wrapper */}
        <div className={`flex items-end gap-1.5 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>

          {/* Message bubble - 카카오톡 스타일 */}
          <div className="relative inline-block max-w-[280px]">
            {isOwnMessage ? (
              /* 내 메시지 - 노란색 말풍선 */
              <div className="relative">
                <div
                  className={`
                    relative px-3 py-2
                    ${message.status === 'failed'
                      ? 'bg-red-100 text-red-900'
                      : message.status === 'sending'
                      ? 'bg-yellow-200 text-gray-900 opacity-70'
                      : 'bg-[#FAE100] text-gray-900'
                    }
                  `}
                  style={{
                    borderRadius: '18px',
                    borderTopRightRadius: '4px',
                  }}
                >
                  <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                  {message.isEdited && (
                    <span className="text-xs text-gray-600 ml-1">
                      (수정됨)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              /* 상대방 메시지 - 회색 말풍선 */
              <div
                className="relative px-3 py-2 bg-[#3d3d3d] text-white"
                style={{
                  borderRadius: '18px',
                  borderTopLeftRadius: '4px',
                }}
              >
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {message.content}
                </p>
                {message.isEdited && (
                  <span className="text-xs text-gray-400 ml-1">
                    (수정됨)
                  </span>
                )}
              </div>
            )}

            {/* Retry button for failed messages */}
            {message.status === 'failed' && onRetry && (
              <button
                onClick={() => onRetry(message.id)}
                className="absolute -bottom-5 right-0 flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
              >
                <RotateCw className="w-3 h-3" />
                재시도
              </button>
            )}
          </div>

          {/* Time and status - only for last message in group */}
          {isLastInGroup && (
            <div className="flex flex-col items-start gap-0.5">
              {/* Unread count for own messages */}
              {isOwnMessage && !message.status && !message.isRead && (
                <span className="text-xs font-bold text-yellow-500">1</span>
              )}
              {/* Time */}
              <span className={`text-xs text-gray-500 ${message.status === 'failed' ? 'text-red-500' : ''}`}>
                {formatTime(message.createdAt)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

export default MessageItem;