/**
 * Chat Hook with React Query Integration
 * Combines refactored chat functionality with React Query for optimal caching and state management
 */

import { useEffect, useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import {
  useConversationsQuery,
  useConversationByIdQuery,
  useMessagesInfiniteQuery,
  useCreateConversationMutation,
  useSendMessageMutation,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteConversationMutation,
  useBlockUserMutation,
  useUnblockUserMutation,
  usePrefetchMessages,
  useInvalidateChat,
  CHAT_QUERY_KEYS,
  MessagesInfiniteData,
  addMessageToInfiniteCache,
  updateMessagesInfiniteCache,
} from './useChatsQuery';
import { useSocketManager } from './useSocketManager';
import { useChatPerformance } from './useChatPerformance';
import { Message, Conversation } from '@/types/chat';
import { SOCKET_EVENTS, UI_CONSTANTS } from '@/constants/chat';
import toast from 'react-hot-toast';

export interface UseChatWithQueryReturn {
  // Conversations
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoadingConversations: boolean;
  conversationsError: Error | null;
  getOrCreateConversation: (userId: string) => Promise<Conversation | null>;
  deleteConversation: (conversationId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;

  // Messages
  messages: Message[];
  hasMoreMessages: boolean;
  isLoadingMessages: boolean;
  isFetchingNextPage: boolean;
  messagesError: Error | null;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  retryMessage: (tempId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;

  // UI State
  typingUser: string | null;
  handleTyping: (isTyping: boolean) => void;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  otherUserInRoom: boolean;  // Track if other user is in the conversation

  // Utilities
  refreshConversations: () => void;
  refreshMessages: () => void;
  prefetchConversation: (conversationId: string) => void;
}

export function useChatWithQuery(conversationId?: string): UseChatWithQueryReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { measurePerformance } = useChatPerformance();
  const { socket, connectionStatus } = useSocketManager();
  const { invalidateConversations, invalidateMessages } = useInvalidateChat();
  const prefetchMessages = usePrefetchMessages();

  // Queries
  const {
    data: conversations = [],
    isLoading: isLoadingConversations,
    error: conversationsError,
    refetch: refetchConversations,
  } = useConversationsQuery();

  // Fetch specific conversation by ID
  const {
    data: conversationById,
    isLoading: isLoadingConversationById,
    error: conversationByIdError,
  } = useConversationByIdQuery(conversationId);

  const {
    data: messagesData,
    isLoading: isLoadingMessages,
    error: messagesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchMessages,
  } = useMessagesInfiniteQuery(conversationId);

  // Flatten messages from all pages
  const messages = useMemo(() => {
    if (!messagesData?.pages) return [];
    return messagesData.pages.flatMap(page => {
      // Add safety check for page structure
      if (!page || !Array.isArray(page.messages)) return [];
      return page.messages;
    });
  }, [messagesData]);

  // Mutations
  const createConversationMutation = useCreateConversationMutation();
  const sendMessageMutation = useSendMessageMutation(conversationId || '', user?.id);
  const markAsReadMutation = useMarkAsReadMutation();
  const markAllAsReadMutation = useMarkAllAsReadMutation();
  const deleteConversationMutation = useDeleteConversationMutation();
  const blockUserMutation = useBlockUserMutation();
  const unblockUserMutation = useUnblockUserMutation();

  // Get current conversation - prefer directly fetched conversation over list
  const currentConversation = useMemo(() => {
    if (!conversationId) return null;
    // Use directly fetched conversation if available
    if (conversationById) return conversationById;
    // Fallback to conversation from list
    return conversations.find(c => c.id === conversationId) || null;
  }, [conversationById, conversations, conversationId]);

  // Track if other user is in the room
  const [otherUserInRoom, setOtherUserInRoom] = useState(false);

  // Reset unread count when entering conversation
  useEffect(() => {
    if (!conversationId) return;

    // Reset unread count to 0 when entering the chat room
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

    // Mark all messages as read on backend
    const markAllRead = async () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
        await fetch(`${API_URL}/chat/conversation/${conversationId}/mark-all-read`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    };

    markAllRead();
  }, [conversationId, queryClient]);

  // Join/Leave conversation room - separate useEffect to prevent re-triggering
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);

    return () => {
      socket.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, conversationId);
    };
  }, [socket, conversationId]); // Only depend on socket and conversationId

  // Socket event handlers with React Query integration
  useEffect(() => {
    if (!socket) return;

    // Handle new message
    const handleNewMessage = (message: Message) => {
      // Only process messages for current conversation when in the room
      if (message.conversationId !== conversationId) return;

      // Skip messages from current user (they're already added optimistically)
      if (message.senderId === user?.id) return;

      measurePerformance('handleNewMessage', async () => {
        // Update messages cache for infinite query using utility function
        queryClient.setQueryData<MessagesInfiniteData>(
          CHAT_QUERY_KEYS.messages(message.conversationId),
          (oldData) => {
            if (!oldData?.pages || oldData.pages.length === 0) return oldData;

            // Check for duplicate
            const exists = oldData.pages.some(page =>
              page.messages.some((m: Message) => m.id === message.id)
            );
            if (exists) return oldData;

            // Add message to cache
            return addMessageToInfiniteCache(oldData, message);
          }
        );

        // Update conversation's last message and keep unread at 0 (we're in the room)
        queryClient.setQueryData<Conversation[]>(
          CHAT_QUERY_KEYS.conversations(),
          (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.map(conv =>
            conv.id === message.conversationId
              ? {
                  ...conv,
                  lastMessage: message,
                  lastMessageAt: message.createdAt,
                  unreadCount: 0  // Keep at 0 since we're actively in the conversation
                }
              : conv
          );
        }
      );
      });
    };

    // Handle message read
    const handleMessageRead = ({
      messageId,
      conversationId: msgConvId,
      readBy,
    }: {
      messageId: string;
      conversationId: string;
      readBy: string;
    }) => {
      // Only update if the reader is not the current user
      if (readBy !== user?.id) {
        // Update message in infinite query cache
        queryClient.setQueryData<MessagesInfiniteData>(
          CHAT_QUERY_KEYS.messages(msgConvId),
          (oldData) => updateMessagesInfiniteCache(oldData, (messages) =>
            messages.map(msg =>
              msg.id === messageId
                ? { ...msg, isRead: true, readAt: new Date() }
                : msg
            )
          )
        );

        // Update unread count in conversation list
        queryClient.setQueryData<Conversation[]>(
          CHAT_QUERY_KEYS.conversations(),
          (old) => {
            if (!old || !Array.isArray(old)) return [];
            return old.map(conv => {
              if (conv.id === msgConvId) {
                const newUnreadCount = Math.max(0, (conv.unreadCount || 0) - 1);
                return { ...conv, unreadCount: newUnreadCount };
              }
              return conv;
            });
          }
        );
      }
    };

    // Handle all messages read
    const handleAllMessagesRead = ({
      conversationId: msgConvId,
      readBy,
    }: {
      conversationId: string;
      readBy: string;
    }) => {
      // Only update if the reader is not the current user
      if (readBy !== user?.id) {
        // Update all messages in infinite query cache
        queryClient.setQueryData<MessagesInfiniteData>(
          CHAT_QUERY_KEYS.messages(msgConvId),
          (oldData) => {
            if (!oldData?.pages) return oldData;

            // Update all messages in all pages
            return {
              ...oldData,
              pages: oldData.pages.map(page => ({
                ...page,
                messages: page.messages.map(msg => {
                  // Mark all messages from current user as read
                  if (msg.senderId === user?.id) {
                    return { ...msg, isRead: true, readAt: new Date() };
                  }
                  return msg;
                })
              }))
            };
          }
        );

        // Clear unread count in conversation list
        queryClient.setQueryData<Conversation[]>(
          CHAT_QUERY_KEYS.conversations(),
          (old) => {
            if (!old || !Array.isArray(old)) return [];
            return old.map(conv => {
              if (conv.id === msgConvId) {
                return { ...conv, unreadCount: 0 };
              }
              return conv;
            });
          }
        );
      }
    };

    // Handle typing indicator
    const typingTimeouts = new Map<string, NodeJS.Timeout>();
    const handleUserTyping = ({
      userId,
      conversationId: typingConvId,
      isTyping,
    }: {
      userId: string;
      conversationId: string;
      isTyping: boolean;
    }) => {
      if (typingConvId === conversationId && userId !== user?.id) {
        const key = `typing-${userId}`;

        // Clear existing timeout
        const existingTimeout = typingTimeouts.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        if (isTyping) {
          // Show typing indicator
          queryClient.setQueryData<string | null>(
            ['chat', 'typing', conversationId],
            userId
          );

          // Auto-hide after delay
          const timeout = setTimeout(() => {
            queryClient.setQueryData<string | null>(
              ['chat', 'typing', conversationId],
              null
            );
            typingTimeouts.delete(key);
          }, UI_CONSTANTS.TYPING_INDICATOR_DELAY * 3);

          typingTimeouts.set(key, timeout);
        } else {
          // Hide typing indicator
          queryClient.setQueryData<string | null>(
            ['chat', 'typing', conversationId],
            null
          );
        }
      }
    };

    // Handle message notification (for users not in conversation room)
    const handleMessageNotification = ({
      conversationId: msgConvId,
      message,
    }: {
      conversationId: string;
      message: Message;
    }) => {
      // IMPORTANT: Ignore notification if we're already in this conversation
      // (new-message event already handles it)
      if (msgConvId === conversationId) {
        console.log('[Chat] Ignoring message-notification - already in conversation');
        return;
      }

      // Update messages cache for other conversations (infinite query)
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.messages(msgConvId),
        (oldData: any) => {
          if (!oldData?.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) return oldData;

          // Add new message to the first page
          const newPages = [...oldData.pages];
          const firstPage = newPages[0];

          // Ensure firstPage has messages array
          if (!firstPage || !Array.isArray(firstPage.messages)) return oldData;

          // Check for duplicate
          const exists = firstPage.messages.find((m: Message) => m.id === message.id);
          if (exists) return oldData;

          newPages[0] = {
            ...firstPage,
            messages: [...firstPage.messages, message]
          };

          return {
            ...oldData,
            pages: newPages
          };
        }
      );

      // Update conversation's last message and unread count for OTHER conversations only
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.map(conv =>
          conv.id === msgConvId
            ? {
                ...conv,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                unreadCount: message.senderId !== user?.id
                  ? (conv.unreadCount || 0) + 1
                  : conv.unreadCount
              }
            : conv
          );
        }
      );
    };

    // Handle conversation reactivated
    const handleConversationReactivated = () => {
      invalidateConversations();
    };

    // Handle user joined conversation
    const handleUserJoined = ({ conversationId: joinedConvId, userId: joinedUserId }: { conversationId: string; userId: string }) => {
      if (joinedConvId === conversationId && joinedUserId !== user?.id) {
        console.log('[Chat] Other user joined conversation');
        setOtherUserInRoom(true);
      }
    };

    // Handle user left conversation
    const handleUserLeft = ({ conversationId: leftConvId, userId: leftUserId }: { conversationId: string; userId: string }) => {
      if (leftConvId === conversationId && leftUserId !== user?.id) {
        console.log('[Chat] Other user left conversation');
        setOtherUserInRoom(false);
      }
    };

    // Handle conversation list refresh (when a left conversation gets new message)
    const handleConversationListRefresh = () => {
      console.log('[Chat] Conversation list refresh event received');
      // Invalidate conversations query to fetch updated list
      queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.conversations()
      });

      // Also invalidate current conversation messages if needed
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: CHAT_QUERY_KEYS.messages(conversationId),
          refetchType: 'none' // Don't auto-refetch, let user trigger it
        });
      }
    };

    // Register event listeners
    socket.on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    socket.on(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
    socket.on(SOCKET_EVENTS.ALL_MESSAGES_READ, handleAllMessagesRead);
    socket.on(SOCKET_EVENTS.MESSAGE_NOTIFICATION, handleMessageNotification);
    socket.on(SOCKET_EVENTS.USER_TYPING, handleUserTyping);
    socket.on(SOCKET_EVENTS.CONVERSATION_REACTIVATED, handleConversationReactivated);
    socket.on(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
    socket.on(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
    socket.on(SOCKET_EVENTS.CONVERSATION_LIST_REFRESH, handleConversationListRefresh);

    // Cleanup - only remove event listeners, don't emit leave-conversation here
    return () => {
      socket.off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      socket.off(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
      socket.off(SOCKET_EVENTS.ALL_MESSAGES_READ, handleAllMessagesRead);
      socket.off(SOCKET_EVENTS.MESSAGE_NOTIFICATION, handleMessageNotification);
      socket.off(SOCKET_EVENTS.USER_TYPING, handleUserTyping);
      socket.off(SOCKET_EVENTS.CONVERSATION_REACTIVATED, handleConversationReactivated);
      socket.off(SOCKET_EVENTS.USER_JOINED, handleUserJoined);
      socket.off(SOCKET_EVENTS.USER_LEFT, handleUserLeft);
      socket.off(SOCKET_EVENTS.CONVERSATION_LIST_REFRESH, handleConversationListRefresh);

      // Clear typing timeouts
      typingTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [socket, conversationId, user?.id, setOtherUserInRoom]); // Minimize dependencies

  // Get typing user from cache
  const typingUser = queryClient.getQueryData<string | null>(
    ['chat', 'typing', conversationId]
  ) || null;

  // Actions
  const getOrCreateConversation = useCallback(async (userId: string) => {
    try {
      const conversation = await createConversationMutation.mutateAsync(userId);
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      return null;
    }
  }, [createConversationMutation]);

  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !content.trim()) return;

    const tempId = `${UI_CONSTANTS.TEMP_ID_PREFIX}${Date.now()}`;
    await sendMessageMutation.mutateAsync({ content, tempId });
  }, [conversationId, sendMessageMutation]);

  const markAsRead = useCallback(async (messageId: string) => {
    if (!conversationId) return;

    await markAsReadMutation.mutateAsync({ conversationId, messageId });

    // Emit WebSocket event for real-time sync
    if (socket) {
      socket.emit(SOCKET_EVENTS.MARK_READ, messageId);
    }
  }, [conversationId, markAsReadMutation, socket]);

  const markAllAsRead = useCallback(async () => {
    if (!conversationId) return;

    await markAllAsReadMutation.mutateAsync(conversationId);

    // Emit WebSocket event for real-time sync
    if (socket) {
      socket.emit(SOCKET_EVENTS.MARK_ALL_READ, conversationId);
    }
  }, [conversationId, markAllAsReadMutation, socket]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await deleteConversationMutation.mutateAsync(conversationId);
  }, [deleteConversationMutation]);

  const blockUser = useCallback(async (userId: string) => {
    await blockUserMutation.mutateAsync(userId);
  }, [blockUserMutation]);

  const unblockUser = useCallback(async (userId: string) => {
    await unblockUserMutation.mutateAsync(userId);
  }, [unblockUserMutation]);

  const handleTyping = useCallback((isTyping: boolean) => {
    if (!socket || !conversationId || !user?.id) return;

    socket.emit(SOCKET_EVENTS.TYPING, {
      conversationId,
      isTyping,
    });
  }, [socket, conversationId, user?.id]);

  const retryMessage = useCallback(async (tempId: string) => {
    if (!conversationId) return;

    return measurePerformance('retryMessage', async () => {
      // Find the failed message
      const failedMessage = messages.find(m => m.tempId === tempId);
      if (!failedMessage) {
        toast.error('Message not found');
        return;
      }

      // Resend the message
      await sendMessage(failedMessage.content);

      // Remove the failed message from cache (infinite query)
      queryClient.setQueryData(
        CHAT_QUERY_KEYS.messages(conversationId),
        (oldData: any) => {
          if (!oldData?.pages || !Array.isArray(oldData.pages) || oldData.pages.length === 0) return oldData;

          // Remove failed message from all pages
          const newPages = oldData.pages.map((page: any) => ({
            ...page,
            messages: Array.isArray(page?.messages)
              ? page.messages.filter((m: Message) => m.tempId !== tempId)
              : []
          }));

          return {
            ...oldData,
            pages: newPages
          };
        }
      );
    });
  }, [conversationId, messages, sendMessage, queryClient, measurePerformance]);

  const refreshConversations = useCallback(() => {
    refetchConversations();
  }, [refetchConversations]);

  const refreshMessages = useCallback(() => {
    if (conversationId) {
      refetchMessages();
    }
  }, [conversationId, refetchMessages]);

  const prefetchConversation = useCallback((conversationId: string) => {
    prefetchMessages(conversationId);
  }, [prefetchMessages]);

  // Load more messages function
  const loadMoreMessages = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return {
    // Conversations
    conversations,
    currentConversation,
    isLoadingConversations,
    conversationsError,
    getOrCreateConversation,
    deleteConversation,
    blockUser,
    unblockUser,

    // Messages
    messages,
    hasMoreMessages: hasNextPage || false,
    isLoadingMessages,
    isFetchingNextPage,
    messagesError,
    sendMessage,
    markAsRead,
    markAllAsRead,
    retryMessage,
    loadMoreMessages,

    // UI State
    typingUser,
    handleTyping,
    connectionStatus,
    otherUserInRoom,

    // Utilities
    refreshConversations,
    refreshMessages,
    prefetchConversation,
  };
}