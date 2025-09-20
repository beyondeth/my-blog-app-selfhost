'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { useMessageManagement } from '@/hooks/useMessageManagement';
import { useChatWithQuery } from '@/hooks/chat/useChatWithQuery';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

interface DMChatAreaProps {
  conversationId: string;
}

const DMChatArea: React.FC<DMChatAreaProps> = ({ conversationId }) => {
  const { user } = useAuth();
  const {
    currentConversation,
    typingUser,
    otherUserInRoom
  } = useChatWithQuery(conversationId);
  const {
    groupedMessages,
    isLoading,
    isSending,
    isFetchingNextPage,
    hasMore,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    markAsRead,
    messageContainerRef,
    scrollToBottom,
  } = useMessageManagement(conversationId);

  // Get the other user
  const otherUser = currentConversation?.user1Id === user?.id
    ? currentConversation?.user2
    : currentConversation?.user1;

  // Track last read message position (no backend calls)
  useEffect(() => {
    // Simply track that user has seen messages, no need to persist
    // The UI will handle display logic based on user presence
  }, [groupedMessages, conversationId]);

  // Show loading state while conversation or initial messages are loading
  if ((isLoading && groupedMessages.length === 0) || (!currentConversation && conversationId)) {
    return (
      <div className="flex flex-col h-full">
        <ChatHeader otherUser={null} isLoading conversationId={conversationId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">대화를 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  // If conversation still couldn't be loaded after loading is done
  if (!currentConversation && !isLoading) {
    return (
      <div className="flex flex-col h-full">
        <ChatHeader otherUser={null} conversationId={conversationId} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500">대화를 불러올 수 없습니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <ChatHeader otherUser={otherUser} conversationId={conversationId} />

      {/* Messages */}
      <MessageList
        groupedMessages={groupedMessages}
        currentUserId={user?.id || ''}
        otherUser={otherUser}
        hasMore={hasMore}
        isLoading={isLoading}
        isFetchingNextPage={isFetchingNextPage}
        onLoadMore={loadMoreMessages}
        onRetry={retryMessage}
        messageContainerRef={messageContainerRef}
        typingUser={typingUser}
        isOtherUserInRoom={otherUserInRoom}
      />

      {/* Input */}
      <MessageInput
        onSendMessage={sendMessage}
        isSending={isSending}
        disabled={!otherUser}
      />
    </div>
  );
};

export default DMChatArea;