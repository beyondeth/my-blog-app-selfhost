/**
 * React Query hooks for Chat functionality
 * Provides data fetching, caching, and mutations with React Query
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  UseQueryOptions
} from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import {
  Conversation,
  Message,
  ChatUser
} from '@/types/chat';
import {
  CACHE_TIMES,
  REFETCH_INTERVALS,
  UI_CONSTANTS
} from '@/constants/chat';
import toast from 'react-hot-toast';

// Query Keys
export const CHAT_QUERY_KEYS = {
  all: ['chat'] as const,
  conversations: () => [...CHAT_QUERY_KEYS.all, 'conversations'] as const,
  conversation: (id: string) => [...CHAT_QUERY_KEYS.all, 'conversation', id] as const,
  messages: (conversationId: string) => [...CHAT_QUERY_KEYS.all, 'messages', conversationId] as const,
  messagesByPage: (conversationId: string, page: number) =>
    [...CHAT_QUERY_KEYS.messages(conversationId), 'page', page] as const,
  unreadCount: () => [...CHAT_QUERY_KEYS.all, 'unreadCount'] as const,
  blockedUsers: () => [...CHAT_QUERY_KEYS.all, 'blockedUsers'] as const,
};

/**
 * Fetch all conversations
 */
export const useConversationsQuery = (options?: UseQueryOptions<Conversation[]>) => {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.conversations(),
    queryFn: async () => {
      const data = await apiClient.getConversations();
      return data;
    },
    staleTime: CACHE_TIMES.CONVERSATIONS,
    refetchInterval: REFETCH_INTERVALS.CONVERSATIONS_ACTIVE,
    refetchIntervalInBackground: false,
    ...options,
  });
};

/**
 * Fetch messages for a conversation with pagination
 */
export const useMessagesQuery = (
  conversationId: string | undefined,
  page = 1,
  options?: UseQueryOptions<{ messages: Message[]; hasMore: boolean }>
) => {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.messagesByPage(conversationId || '', page),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      const data = await apiClient.getMessages(conversationId, page);
      return data;
    },
    enabled: !!conversationId,
    staleTime: CACHE_TIMES.MESSAGES,
    ...options,
  });
};

/**
 * Infinite query for messages - Real infinite pagination
 */
export const useMessagesInfiniteQuery = (conversationId: string | undefined) => {
  return useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.messages(conversationId || ''),
    queryFn: async ({ pageParam = 1 }) => {
      if (!conversationId) throw new Error('Conversation ID is required');

      const data = await apiClient.getMessages(conversationId, pageParam);
      return {
        messages: data.messages,
        hasMore: data.hasMore,
        page: pageParam
      };
    },
    getNextPageParam: (lastPage) => {
      // Return next page number if there are more messages
      return lastPage.hasMore ? lastPage.page + 1 : undefined;
    },
    enabled: !!conversationId,
    staleTime: CACHE_TIMES.MESSAGES,
    // Start from latest messages (page 1)
    initialPageParam: 1,
  });
};

/**
 * Get or create conversation mutation
 */
export const useCreateConversationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return await apiClient.getOrCreateConversation(userId);
    },
    onSuccess: (conversation) => {
      // Update conversations cache
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old = []) => {
          const exists = old.find(c => c.id === conversation.id);
          if (exists) return old;
          return [conversation, ...old];
        }
      );

      // Cache individual conversation
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.conversation(conversation.id),
        conversation
      );
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create conversation');
    },
  });
};

/**
 * Send message mutation with optimistic update
 */
export const useSendMessageMutation = (conversationId: string, userId?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ content, tempId }: { content: string; tempId: string }) => {
      return await apiClient.sendMessage(conversationId, content, tempId);
    },
    onMutate: async ({ content, tempId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: CHAT_QUERY_KEYS.messages(conversationId)
      });

      // Snapshot previous messages
      const previousMessages = queryClient.getQueryData<Message[]>(
        CHAT_QUERY_KEYS.messages(conversationId)
      );

      // Optimistically update messages
      const optimisticMessage: Message = {
        id: tempId,
        tempId,
        conversationId,
        content,
        senderId: userId || '', // Use actual user ID passed from component
        createdAt: new Date(),
        isRead: true,
        readAt: new Date(),
        isEdited: false,
        isDeleted: false,
        status: 'sending',
      };

      queryClient.setQueryData<Message[]>(
        CHAT_QUERY_KEYS.messages(conversationId),
        (old = []) => [...old, optimisticMessage]
      );

      // Return context for rollback
      return { previousMessages };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        queryClient.setQueryData(
          CHAT_QUERY_KEYS.messages(conversationId),
          context.previousMessages
        );
      }
      toast.error('Failed to send message');
    },
    onSuccess: (sentMessage, { tempId }) => {
      // Only update the message list - conversation list will be updated by WebSocket
      queryClient.setQueryData<Message[]>(
        CHAT_QUERY_KEYS.messages(conversationId),
        (old = []) => old.map(msg =>
          msg.tempId === tempId ? sentMessage : msg
        )
      );

      // Skip conversation update here - let WebSocket handle it to reduce duplication
    },
  });
};

/**
 * Mark message as read mutation
 */
export const useMarkAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ conversationId, messageId }: { conversationId: string; messageId: string }) => {
      return await apiClient.markAsRead(messageId);
    },
    onSuccess: (_, { conversationId, messageId }) => {
      // Update message in cache
      queryClient.setQueryData<Message[]>(
        CHAT_QUERY_KEYS.messages(conversationId),
        (old = []) => old.map(msg =>
          msg.id === messageId
            ? { ...msg, isRead: true, readAt: new Date() }
            : msg
        )
      );

      // Update unread count in conversations
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old = []) => old.map(conv => {
          if (conv.id === conversationId && conv.unreadCount > 0) {
            return { ...conv, unreadCount: conv.unreadCount - 1 };
          }
          return conv;
        })
      );
    },
  });
};

/**
 * Mark all messages as read mutation
 */
export const useMarkAllAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiClient.markAllAsRead(conversationId);
    },
    onSuccess: (_, conversationId) => {
      // Update all messages in cache
      queryClient.setQueryData<Message[]>(
        CHAT_QUERY_KEYS.messages(conversationId),
        (old = []) => old.map(msg => ({
          ...msg,
          isRead: true,
          readAt: msg.readAt || new Date()
        }))
      );

      // Reset unread count
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old = []) => old.map(conv =>
          conv.id === conversationId
            ? { ...conv, unreadCount: 0 }
            : conv
        )
      );
    },
  });
};

/**
 * Delete conversation mutation
 */
export const useDeleteConversationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiClient.deleteConversation(conversationId);
    },
    onSuccess: (_, conversationId) => {
      // Remove from conversations list
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old = []) => old.filter(conv => conv.id !== conversationId)
      );

      // Invalidate messages cache
      queryClient.removeQueries({
        queryKey: CHAT_QUERY_KEYS.messages(conversationId),
      });

      toast.success('Conversation deleted');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete conversation');
    },
  });
};

/**
 * Block user mutation
 */
export const useBlockUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return await apiClient.blockUser(userId);
    },
    onSuccess: (_, userId) => {
      // Update blocked users cache
      queryClient.setQueryData<string[]>(
        CHAT_QUERY_KEYS.blockedUsers(),
        (old = []) => [...old, userId]
      );

      // Remove conversations with blocked user
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old = []) => old.filter(conv =>
          conv.user1Id !== userId && conv.user2Id !== userId
        )
      );

      toast.success('User blocked');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to block user');
    },
  });
};

/**
 * Unblock user mutation
 */
export const useUnblockUserMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      return await apiClient.unblockUser(userId);
    },
    onSuccess: (_, userId) => {
      // Update blocked users cache
      queryClient.setQueryData<string[]>(
        CHAT_QUERY_KEYS.blockedUsers(),
        (old = []) => old.filter(id => id !== userId)
      );

      // Refetch conversations to include unblocked user
      queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.conversations(),
      });

      toast.success('User unblocked');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to unblock user');
    },
  });
};

/**
 * Prefetch messages for a conversation
 */
export const usePrefetchMessages = () => {
  const queryClient = useQueryClient();

  return (conversationId: string) => {
    queryClient.prefetchQuery({
      queryKey: CHAT_QUERY_KEYS.messagesByPage(conversationId, 1),
      queryFn: async () => {
        return await apiClient.getMessages(conversationId, 1);
      },
      staleTime: CACHE_TIMES.MESSAGES,
    });
  };
};

/**
 * Invalidate chat queries utility
 */
export const useInvalidateChat = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () => {
      queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.all,
      });
    },
    invalidateConversations: () => {
      queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.conversations(),
      });
    },
    invalidateMessages: (conversationId: string) => {
      queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.messages(conversationId),
      });
    },
  };
};