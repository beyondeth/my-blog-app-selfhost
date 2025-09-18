import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useChat } from './useChat';
import { useDMStore } from '@/stores/dmStore';
import { useAuth } from '@/providers/AuthProviderV2';
import type { Conversation } from '@/components/dm/DMLayout/DMLayout.types';

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
  const { conversations, loading, fetchConversations } = useChat();
  const { conversationFilter, blockedUsers } = useDMStore();
  const { user } = useAuth();

  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Abort controller for cleanup
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Load more conversations
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setError(null);

    try {
      // In real implementation, this would fetch more from API
      // For now, we'll simulate pagination
      const nextPage = page + 1;
      setPage(nextPage);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check if there are more conversations
      if (nextPage * 20 >= 100) { // Assuming max 100 conversations
        setHasMore(false);
      }
    } catch (err) {
      setError('Failed to load more conversations');
      console.error('Load more error:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page]);

  // Refresh conversations
  const refreshConversations = useCallback(async () => {
    setError(null);
    try {
      await fetchConversations();
      setPage(1);
      setHasMore(true);
    } catch (err) {
      setError('Failed to refresh conversations');
      console.error('Refresh error:', err);
    }
  }, [fetchConversations]);

  // Mark conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${API_URL}/chat/conversation/${conversationId}/read`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      // Update local state would happen through socket events
    } catch (err) {
      console.error('Mark as read error:', err);
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${API_URL}/chat/conversation/${conversationId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete conversation');
      }

      await refreshConversations();
    } catch (err) {
      setError('Failed to delete conversation');
      console.error('Delete error:', err);
    }
  }, [refreshConversations]);

  // Initial load
  useEffect(() => {
    refreshConversations();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    filteredConversations,
    isLoading: loading,
    error,
    hasMore,
    loadMore,
    refreshConversations,
    markAsRead,
    deleteConversation,
  };
}