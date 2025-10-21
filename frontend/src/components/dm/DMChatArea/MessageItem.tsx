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
  isLastMessage?: boolean;  // Whether this is the very last message in conversation
  isOtherUserInRoom?: boolean;  // Whether other user is actively in the room
  otherUser?: User;
  onRetry?: (messageId: string) => void;
  shouldShowTime?: boolean;  // Whether to show timestamp
}

const MessageItem: React.FC<MessageItemProps> = memo(({
  message,
  isOwnMessage,
  showAvatar,
  isFirstInGroup,
  isLastInGroup,
  isLastMessage = false,
  isOtherUserInRoom = false,
  otherUser,
  onRetry,
  shouldShowTime = true,
}) => {

  // 개별 메시지 읽음 표시 제거 - 대화 레벨에서만 읽음 상태 관리
  // const shouldShowReadText = isOwnMessage && isLastMessage && isOtherUserInRoom && message.isRead;

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

          {/* Time - 같은 "분" 안의 마지막 메시지에만 표시 */}
          {shouldShowTime && (
            <div className="flex flex-col items-end gap-0.5">
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