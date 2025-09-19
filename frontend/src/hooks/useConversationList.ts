import { useMemo, useCallback } from 'react';
import { useChatWithQuery } from './chat/useChatWithQuery';
import { useDMStore } from '@/stores/dmStore';
import { useAuth } from '@/providers/AuthProviderV2';
import type { Conversation } from '@/types/chat';

interface UseConversationListReturn {
  filteredConversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refreshConversations: () => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
}

export function useConversationList(): UseConversationListReturn {
  const { conversationFilter, blockedUsers } = useDMStore();
  const { user } = useAuth();

  // Use React Query based hook
  const {
    conversations,
    isLoadingConversations,
    conversationsError,
    refreshConversations: refreshConvs,
    deleteConversation: deleteConv,
    markAsRead: markRead,
  } = useChatWithQuery();

  // Filter and sort conversations
  const filteredConversations = useMemo(() => {
    if (!conversations || !user) return [];

    let filtered = [...conversations];

    // Filter blocked users
    filtered = filtered.filter(conversation => {
      const otherUserId = conversation.user1Id === user.id
        ? conversation.user2Id
        : conversation.user1Id;
      return !blockedUsers.has(otherUserId);
    });

    // Apply search filter
    if (conversationFilter.searchQuery) {
      const searchLower = conversationFilter.searchQuery.toLowerCase();
      filtered = filtered.filter(conversation => {
        const otherUser = conversation.user1Id === user.id
          ? conversation.user2
          : conversation.user1;
        return otherUser?.username?.toLowerCase().includes(searchLower);
      });
    }

    // Apply unread filter
    if (conversationFilter.showUnreadOnly) {
      filtered = filtered.filter(conversation =>
        conversation.unreadCount && conversation.unreadCount > 0
      );
    }

    // Sort by last message time
    filtered.sort((a, b) => {
      const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return bTime - aTime;
    });

    return filtered;
  }, [conversations, user, blockedUsers, conversationFilter]);

  // Load more conversations (handled by React Query pagination)
  const loadMore = useCallback(async () => {
    // React Query handles pagination internally
    // This is a placeholder for compatibility
    console.log('Load more conversations - handled by React Query');
  }, []);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    await refreshConvs();
  }, [refreshConvs]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    await markRead(''); // This needs to be updated to handle message IDs
  }, [markRead]);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    await deleteConv(conversationId);
  }, [deleteConv]);

  return {
    filteredConversations,
    isLoading: isLoadingConversations,
    error: conversationsError?.message || null,
    hasMore: false, // React Query handles this internally
    loadMore,
    refreshConversations,
    markAsRead,
    deleteConversation,
  };
}