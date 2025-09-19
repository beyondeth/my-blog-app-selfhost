/**
 * Messages Hook
 * Manages messages for a specific conversation
 */

import { useEffect, useCallback, useReducer, useRef } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { apiClient } from '@/lib/api';
import { chatReducer, initialChatState } from '@/reducers/chatReducer';
import { useSocketManager } from './useSocketManager';
import { SOCKET_EVENTS, ERROR_MESSAGES, UI_CONSTANTS } from '@/constants/chat';
import { Message, MessageStatus } from '@/types/chat';
import toast from 'react-hot-toast';

export interface UseMessagesReturn {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  isSending: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<Message | void>;
  loadMore: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  retryMessage: (tempId: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  handleTyping: (isTyping: boolean) => void;
  typingUsers: Map<string, boolean>;
}

export function useMessages(conversationId?: string): UseMessagesReturn {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialChatState,
    messages: [],
    hasMore: true,
    currentPage: 1
  });

  const { user } = useAuth();
  const { emit, on, off, connectionStatus, joinConversation, leaveConversation } = useSocketManager();
  const abortControllerRef = useRef<AbortController | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch messages with AbortController
  const fetchMessages = useCallback(async (page: number = 1) => {
    if (!conversationId) return;

    // Cancel previous request if exists
    if (page === 1) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = new AbortController();
    }

    dispatch({ type: 'FETCH_MESSAGES_START' });

    try {
      const data = await apiClient.getMessages(
        conversationId,
        page,
        abortControllerRef.current?.signal
      );

      dispatch({
        type: 'FETCH_MESSAGES_SUCCESS',
        payload: {
          messages: data.messages,
          hasMore: data.hasMore,
          page
        }
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[useMessages] Error fetching messages:', error);
        dispatch({
          type: 'FETCH_MESSAGES_ERROR',
          payload: error
        });
      }
    }
  }, [conversationId]);

  // Send message with optimistic update and tempId
  const sendMessage = useCallback(async (content: string): Promise<Message | void> => {
    if (!conversationId || !user) {
      toast.error(ERROR_MESSAGES.UNAUTHORIZED);
      return;
    }

    const tempId = `${UI_CONSTANTS.TEMP_ID_PREFIX}${Date.now()}-${Math.random()}`;

    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      content,
      isRead: false,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
      sender: {
        id: user.id,
        username: user.username,
        profileImage: user.profileImage
      },
      status: 'sending' as MessageStatus
    };

    // Add optimistic message
    dispatch({
      type: 'ADD_OPTIMISTIC_MESSAGE',
      payload: optimisticMessage
    });

    try {
      // Send to server with tempId
      const message = await apiClient.sendMessage(conversationId, content, tempId);

      // Replace optimistic message with real one
      dispatch({
        type: 'REPLACE_OPTIMISTIC_MESSAGE',
        payload: {
          tempId,
          message
        }
      });

      return message;
    } catch (error: any) {
      console.error('[useMessages] Error sending message:', error);

      // Mark message as failed
      dispatch({
        type: 'MARK_MESSAGE_FAILED',
        payload: { tempId }
      });

      toast.error(ERROR_MESSAGES.SEND_FAILED);
    }
  }, [conversationId, user]);

  // Load more messages (pagination)
  const loadMore = useCallback(async () => {
    if (!state.hasMore || state.loading.messages) return;

    await fetchMessages(state.currentPage + 1);
  }, [state.hasMore, state.loading.messages, state.currentPage, fetchMessages]);

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string) => {
    if (!conversationId) return;

    try {
      await apiClient.markMessageAsRead(messageId);

      dispatch({
        type: 'MARK_MESSAGE_READ',
        payload: {
          messageId,
          readAt: new Date()
        }
      });

      // Emit socket event
      emit(SOCKET_EVENTS.MARK_READ, messageId);
    } catch (error: any) {
      console.error('[useMessages] Error marking message as read:', error);
    }
  }, [conversationId, emit]);

  // Mark all messages as read
  const markAllAsRead = useCallback(async () => {
    if (!conversationId) return;

    try {
      await apiClient.markAllMessagesAsRead(conversationId);

      dispatch({
        type: 'MARK_ALL_MESSAGES_READ',
        payload: { conversationId }
      });
    } catch (error: any) {
      console.error('[useMessages] Error marking all messages as read:', error);
    }
  }, [conversationId]);

  // Retry failed message
  const retryMessage = useCallback(async (tempId: string) => {
    const failedMessage = state.messages.find(
      msg => msg.id === tempId && msg.status === 'failed'
    );

    if (!failedMessage) return;

    // Remove failed message
    dispatch({
      type: 'DELETE_MESSAGE',
      payload: tempId
    });

    // Resend
    await sendMessage(failedMessage.content);
  }, [state.messages, sendMessage]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      await apiClient.deleteMessage(messageId);

      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: messageId,
          updates: {
            isDeleted: true,
            deletedAt: new Date()
          }
        }
      });

      toast.success('Message deleted');
    } catch (error: any) {
      console.error('[useMessages] Error deleting message:', error);
      toast.error('Failed to delete message');
    }
  }, []);

  // Handle typing indicator
  const handleTyping = useCallback((isTyping: boolean) => {
    if (!conversationId) return;

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    emit(SOCKET_EVENTS.TYPING, {
      conversationId,
      isTyping
    });

    // Auto-stop typing after delay
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        emit(SOCKET_EVENTS.TYPING, {
          conversationId,
          isTyping: false
        });
      }, UI_CONSTANTS.TYPING_INDICATOR_DELAY);
    }
  }, [conversationId, emit]);

  // Socket event handlers
  useEffect(() => {
    if (!conversationId || connectionStatus !== 'connected') return;

    // Join conversation room
    joinConversation(conversationId);

    // Handle new messages
    const handleNewMessage = (message: Message) => {
      if (message.conversationId !== conversationId) return;

      // Skip if it's our own message (already handled optimistically)
      if (message.senderId === user?.id) {
        // Check if we need to replace a temp message
        const tempMessage = state.messages.find(
          msg => msg.id.startsWith(UI_CONSTANTS.TEMP_ID_PREFIX) &&
                 msg.content === message.content &&
                 msg.senderId === message.senderId
        );

        if (tempMessage) {
          dispatch({
            type: 'REPLACE_OPTIMISTIC_MESSAGE',
            payload: {
              tempId: tempMessage.id,
              message
            }
          });
        }
        return;
      }

      // Add message from other user
      dispatch({
        type: 'ADD_MESSAGE',
        payload: message
      });

      // Auto mark as read if conversation is active
      markAsRead(message.id);
    };

    // Handle typing events
    const handleUserTyping = (data: { userId: string; isTyping: boolean }) => {
      if (data.userId !== user?.id) {
        dispatch({
          type: 'SET_TYPING_USER',
          payload: data
        });
      }
    };

    // Handle read receipts
    const handleMessageRead = (data: { messageId: string; userId: string }) => {
      dispatch({
        type: 'MARK_MESSAGE_READ',
        payload: {
          messageId: data.messageId,
          readAt: new Date()
        }
      });
    };

    on(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
    on(SOCKET_EVENTS.USER_TYPING, handleUserTyping);
    on(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);

    return () => {
      // Leave conversation room
      leaveConversation(conversationId);

      // Clear typing users
      dispatch({ type: 'CLEAR_TYPING_USERS' });

      // Remove event listeners
      off(SOCKET_EVENTS.NEW_MESSAGE, handleNewMessage);
      off(SOCKET_EVENTS.USER_TYPING, handleUserTyping);
      off(SOCKET_EVENTS.MESSAGE_READ, handleMessageRead);
    };
  }, [conversationId, connectionStatus, user?.id, joinConversation, leaveConversation, on, off, markAsRead, state.messages]);

  // Fetch initial messages and mark as read
  useEffect(() => {
    if (conversationId) {
      // Reset messages before fetching new ones
      dispatch({ type: 'RESET_MESSAGES' });

      // Fetch messages
      fetchMessages(1);

      // Mark all as read
      markAllAsRead();
    }

    return () => {
      // Cleanup: abort any pending requests
      abortControllerRef.current?.abort();

      // Clear typing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, fetchMessages, markAllAsRead]);

  return {
    messages: state.messages,
    hasMore: state.hasMore,
    isLoading: state.loading.messages,
    isSending: state.loading.sending,
    error: state.error,
    sendMessage,
    loadMore,
    markAsRead,
    markAllAsRead,
    retryMessage,
    deleteMessage,
    handleTyping,
    typingUsers: state.typingUsers
  };
}