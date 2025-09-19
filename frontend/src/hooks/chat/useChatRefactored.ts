/**
 * Refactored Chat Hook
 * Combines all separated hooks for a complete chat functionality
 * This is the main hook that replaces the old useChat
 */

import { useCallback, useMemo } from 'react';
import { useConversations } from './useConversations';
import { useMessages } from './useMessages';
import { useSocketManager } from './useSocketManager';
import { useChatPerformance } from './useChatPerformance';
import { Message, Conversation } from '@/types/chat';

export interface UseChatRefactoredReturn {
  // From useConversations
  conversations: Conversation[];
  currentConversation: Conversation | null;
  getOrCreateConversation: (userId: string) => Promise<Conversation | null>;
  fetchConversations: () => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;

  // From useMessages
  messages: Message[];
  hasMore: boolean;
  sendMessage: (content: string) => Promise<Message | void>;
  retryMessage: (tempId: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  handleTyping: (isTyping: boolean) => void;
  typingUser: string | null;

  // Loading states
  loading: boolean;
  isSending: boolean;

  // From useSocketManager
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';

  // Error state
  error: Error | null;
}

export function useChatRefactored(conversationId?: string): UseChatRefactoredReturn {
  const { measurePerformance } = useChatPerformance();
  const { connectionStatus } = useSocketManager();

  const {
    conversations,
    currentConversation,
    isLoading: conversationsLoading,
    error: conversationsError,
    fetchConversations: fetchConversationsBase,
    getOrCreateConversation: getOrCreateConversationBase,
    deleteConversation: deleteConversationBase,
    blockUser: blockUserBase,
    unblockUser
  } = useConversations();

  const {
    messages,
    hasMore,
    isLoading: messagesLoading,
    isSending,
    error: messagesError,
    sendMessage: sendMessageBase,
    loadMore,
    markAsRead: markAsReadBase,
    markAllAsRead: markAllAsReadBase,
    retryMessage: retryMessageBase,
    deleteMessage: deleteMessageBase,
    handleTyping,
    typingUsers
  } = useMessages(conversationId);

  // Wrap functions with performance monitoring
  const fetchConversations = useCallback(async () => {
    await measurePerformance('fetchConversations', async () => {
      await fetchConversationsBase();
    });
  }, [fetchConversationsBase, measurePerformance]);

  const getOrCreateConversation = useCallback(async (userId: string) => {
    return await measurePerformance('getOrCreateConversation', async () => {
      return await getOrCreateConversationBase(userId);
    });
  }, [getOrCreateConversationBase, measurePerformance]);

  const sendMessage = useCallback(async (content: string) => {
    return await measurePerformance('sendMessage', async () => {
      return await sendMessageBase(content);
    });
  }, [sendMessageBase, measurePerformance]);

  const markAsRead = useCallback(async (messageId: string) => {
    await measurePerformance('markAsRead', async () => {
      await markAsReadBase(messageId);
    });
  }, [markAsReadBase, measurePerformance]);

  const markAllAsRead = useCallback(async () => {
    await measurePerformance('markAllAsRead', async () => {
      await markAllAsReadBase();
    });
  }, [markAllAsReadBase, measurePerformance]);

  const loadMoreMessages = useCallback(async () => {
    await measurePerformance('loadMoreMessages', async () => {
      await loadMore();
    });
  }, [loadMore, measurePerformance]);

  const retryMessage = useCallback(async (tempId: string) => {
    await measurePerformance('retryMessage', async () => {
      await retryMessageBase(tempId);
    });
  }, [retryMessageBase, measurePerformance]);

  const deleteMessage = useCallback(async (messageId: string) => {
    await measurePerformance('deleteMessage', async () => {
      await deleteMessageBase(messageId);
    });
  }, [deleteMessageBase, measurePerformance]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await measurePerformance('deleteConversation', async () => {
      await deleteConversationBase(conversationId);
    });
  }, [deleteConversationBase, measurePerformance]);

  const blockUser = useCallback(async (userId: string) => {
    await measurePerformance('blockUser', async () => {
      await blockUserBase(userId);
    });
  }, [blockUserBase, measurePerformance]);

  // Convert typingUsers Map to single typingUser for backward compatibility
  const typingUser = useMemo(() => {
    const typingUserIds = Array.from(typingUsers.keys());
    return typingUserIds.length > 0 ? typingUserIds[0] : null;
  }, [typingUsers]);

  // Combine loading states
  const loading = conversationsLoading || messagesLoading;

  // Combine errors (prioritize messages error if both exist)
  const error = messagesError || conversationsError;

  return {
    // Conversations
    conversations,
    currentConversation,
    getOrCreateConversation,
    fetchConversations,
    deleteConversation,
    blockUser,

    // Messages
    messages,
    hasMore,
    sendMessage,
    retryMessage,
    markAsRead,
    markAllAsRead,
    loadMoreMessages,
    deleteMessage,
    handleTyping,
    typingUser,

    // Loading states
    loading,
    isSending,

    // Connection
    connectionStatus,

    // Error
    error
  };
}