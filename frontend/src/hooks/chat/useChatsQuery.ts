/**
 * React Query hooks for Chat functionality
 * Provides data fetching, caching, and mutations with React Query
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  UseQueryOptions,
  InfiniteData
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
import {
  convertApiConversation,
  convertApiMessage,
  convertConversations,
  convertMessagesResponse
} from '@/lib/api/converters/chat.converter';

// Type definitions for infinite query
export interface MessagePage {
  messages: Message[];
  hasMore: boolean;
  page: number;
}

export type MessagesInfiniteData = InfiniteData<MessagePage>;

// Query Keys
export const CHAT_QUERY_KEYS = {
  all: ['chat'] as const,
  conversations: () => [...CHAT_QUERY_KEYS.all, 'conversations'] as const,
  conversation: (id: string) => [...CHAT_QUERY_KEYS.all, 'conversation', id] as const,
  conversationById: (id: string) => [...CHAT_QUERY_KEYS.all, 'conversation-by-id', id] as const,
  messages: (conversationId: string) => [...CHAT_QUERY_KEYS.all, 'messages', conversationId] as const,
  messagesByPage: (conversationId: string, page: number) =>
    [...CHAT_QUERY_KEYS.messages(conversationId), 'page', page] as const,
  unreadCount: () => [...CHAT_QUERY_KEYS.all, 'unreadCount'] as const,
  blockedUsers: () => [...CHAT_QUERY_KEYS.all, 'blockedUsers'] as const,
};

// Utility functions for working with infinite query cache
export const updateMessagesInfiniteCache = (
  oldData: MessagesInfiniteData | undefined,
  updater: (messages: Message[]) => Message[]
): MessagesInfiniteData | undefined => {
  if (!oldData?.pages) return oldData;

  return {
    ...oldData,
    pages: oldData.pages.map((page, index) => ({
      ...page,
      messages: index === 0 ? updater(page.messages) : page.messages
    }))
  };
};

export const addMessageToInfiniteCache = (
  oldData: MessagesInfiniteData | undefined,
  message: Message
): MessagesInfiniteData | undefined => {
  if (!oldData?.pages || oldData.pages.length === 0) {
    // Create first page if no pages exist
    return {
      pages: [{
        messages: [message],
        hasMore: false,
        page: 1
      }],
      pageParams: [1]
    };
  }

  // Add to first page (most recent messages)
  return {
    ...oldData,
    pages: oldData.pages.map((page, index) =>
      index === 0
        ? { ...page, messages: [...page.messages, message] }
        : page
    )
  };
};

/**
 * Fetch all conversations
 */
export const useConversationsQuery = (options?: UseQueryOptions<Conversation[]>) => {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.conversations(),
    queryFn: async () => {
      const data = await apiClient.getConversations();
      // Convert API response to frontend types
      return convertConversations(data);
    },
    staleTime: CACHE_TIMES.CONVERSATIONS,
    refetchInterval: REFETCH_INTERVALS.CONVERSATIONS_ACTIVE,
    refetchIntervalInBackground: false,
    refetchOnMount: true, // DM 열 때마다 최신 대화 목록 확인
    refetchOnWindowFocus: true, // 창 포커스 시 refetch
    ...options,
  });
};

/**
 * Fetch single conversation by ID
 */
export const useConversationByIdQuery = (
  conversationId: string | undefined,
  options?: UseQueryOptions<Conversation>
) => {
  return useQuery({
    queryKey: CHAT_QUERY_KEYS.conversationById(conversationId || ''),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      const data = await apiClient.getConversationById(conversationId);
      // Convert API response to frontend types
      return convertApiConversation(data);
    },
    enabled: !!conversationId,
    staleTime: CACHE_TIMES.CONVERSATIONS,
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
      return convertMessagesResponse(data);
    },
    enabled: !!conversationId,
    staleTime: CACHE_TIMES.MESSAGES,
    ...options,
  });
};

/**
 * Infinite query for messages - Real infinite pagination with defensive programming
 */
export const useMessagesInfiniteQuery = (conversationId: string | undefined) => {
  return useInfiniteQuery({
    queryKey: CHAT_QUERY_KEYS.messages(conversationId || ''),
    queryFn: async ({ pageParam }) => {
      // Always use pageParam with default fallback
      const page = pageParam || 1;

      if (!conversationId) {
        // Return empty structure instead of throwing
        return {
          messages: [],
          hasMore: false,
          page: page
        };
      }

      try {
        const data = await apiClient.getMessages(conversationId, page);
        const converted = convertMessagesResponse(data);

        // Ensure data structure is valid
        return {
          messages: Array.isArray(converted?.messages) ? converted.messages : [],
          hasMore: Boolean(converted?.hasMore),
          page: page
        };
      } catch (error) {
        console.error('[useMessagesInfiniteQuery] Error fetching messages:', error);
        // Return empty structure on error
        return {
          messages: [],
          hasMore: false,
          page: page
        };
      }
    },
    initialPageParam: 1,
    // Smart cache management: 짧은 staleTime으로 DM 열 때마다 최신 확인
    staleTime: 10 * 1000, // 10초 - 짧게 설정해서 자주 최신 확인
    gcTime: 5 * 60 * 1000, // 5분 - 캐시는 오래 유지
    refetchOnMount: true, // 마운트 시 refetch
    refetchOnReconnect: true, // 재연결 시 refetch
    getNextPageParam: (lastPage) => {
      // Simplified: Only check lastPage, don't use allPages
      try {
        if (!lastPage) return undefined;

        const hasMore = Boolean(lastPage?.hasMore);
        const currentPage = Number(lastPage?.page) || 1;

        return hasMore ? currentPage + 1 : undefined;
      } catch (error) {
        console.error('[getNextPageParam] Error:', error);
        return undefined;
      }
    },
    enabled: Boolean(conversationId),
    retry: (failureCount, error: any) => {
      // Don't retry on 404 or 403
      if (error?.response?.status === 404 || error?.response?.status === 403) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    }
  });
};

/**
 * Get or create conversation mutation
 */
export const useCreateConversationMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const data = await apiClient.getOrCreateConversation(userId);
      return convertApiConversation(data);
    },
    onSuccess: (conversation) => {
      // Update conversations cache
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old) => {
          if (!old || !Array.isArray(old)) return [conversation];
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
      const data = await apiClient.sendMessage(conversationId, content, tempId);
      return convertApiMessage(data);
    },
    onMutate: async ({ content, tempId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: CHAT_QUERY_KEYS.messages(conversationId)
      });

      // Snapshot previous messages for rollback
      const previousData = queryClient.getQueryData<MessagesInfiniteData>(
        CHAT_QUERY_KEYS.messages(conversationId)
      );

      // Create optimistic message
      const optimisticMessage: Message = {
        id: tempId,
        tempId,
        conversationId,
        content,
        senderId: userId || '',
        createdAt: new Date(),
        isEdited: false,
        isDeleted: false,
        status: 'sending',
      };

      // Optimistically update messages using infinite query structure
      queryClient.setQueryData<MessagesInfiniteData>(
        CHAT_QUERY_KEYS.messages(conversationId),
        (oldData) => addMessageToInfiniteCache(oldData, optimisticMessage)
      );

      // Return context for rollback
      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(
          CHAT_QUERY_KEYS.messages(conversationId),
          context.previousData
        );
      }
      toast.error('Failed to send message');
    },
    onSuccess: (sentMessage, { tempId }) => {
      // Update the optimistic message with real data from server
      queryClient.setQueryData<MessagesInfiniteData>(
        CHAT_QUERY_KEYS.messages(conversationId),
        (oldData) => updateMessagesInfiniteCache(oldData, (messages) =>
          messages.map(msg =>
            msg.tempId === tempId ? { ...sentMessage, status: 'sent' } : msg
          )
        )
      );

      // Conversation list will be updated by WebSocket
    },
  });
};

// 개별 메시지 읽음 처리 제거 - 대화 레벨에서만 읽음 상태 관리

/**
 * Mark all messages as read mutation
 * 대화 레벨에서 읽음 상태 관리 - unreadCount만 업데이트
 */
export const useMarkAllAsReadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      return await apiClient.markAllAsRead(conversationId);
    },
    onSuccess: (_, conversationId) => {
      // 개별 메시지 업데이트 제거 - 대화 레벨에서만 관리

      // Reset unread count
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.map(conv =>
            conv.id === conversationId
              ? { ...conv, unreadCount: 0 }
              : conv
          );
        }
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
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.filter(conv => conv.id !== conversationId);
        }
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
        (old) => {
          if (!old || !Array.isArray(old)) return [userId];
          return [...old, userId];
        }
      );

      // Remove conversations with blocked user
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.filter(conv =>
            conv.user1Id !== userId && conv.user2Id !== userId
          );
        }
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
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.filter(id => id !== userId);
        }
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