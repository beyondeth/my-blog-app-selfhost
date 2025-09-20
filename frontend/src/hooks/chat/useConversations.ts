/**
 * Conversations Hook
 * Manages conversation list and related operations
 */

import { useEffect, useCallback, useReducer, useRef } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { apiClient } from '@/lib/api';
import { chatReducer, initialChatState } from '@/reducers/chatReducer';
import { useSocketManager } from './useSocketManager';
import { SOCKET_EVENTS, ERROR_MESSAGES } from '@/constants/chat';
import { Conversation, NewMessagePayload } from '@/types/chat';
import { convertConversations, convertApiConversation } from '@/lib/api/converters/chat.converter';
import toast from 'react-hot-toast';

export interface UseConversationsReturn {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: Error | null;
  fetchConversations: () => Promise<void>;
  getOrCreateConversation: (userId: string) => Promise<Conversation | null>;
  deleteConversation: (conversationId: string) => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const [state, dispatch] = useReducer(chatReducer, {
    ...initialChatState,
    conversations: [],
    currentConversation: null
  });

  const { user } = useAuth();
  const { on, off, connectionStatus } = useSocketManager();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch conversations with AbortController
  const fetchConversations = useCallback(async () => {
    // Cancel previous request if exists
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    dispatch({ type: 'FETCH_CONVERSATIONS_START' });

    try {
      const data = await apiClient.getConversations(
        abortControllerRef.current.signal
      );
      const conversations = convertConversations(data);

      dispatch({
        type: 'FETCH_CONVERSATIONS_SUCCESS',
        payload: conversations
      });
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('[useConversations] Error fetching conversations:', error);
        dispatch({
          type: 'FETCH_CONVERSATIONS_ERROR',
          payload: error
        });
      }
    }
  }, []);

  // Get or create conversation
  const getOrCreateConversation = useCallback(async (userId: string): Promise<Conversation | null> => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'conversations', value: true } });

    try {
      const data = await apiClient.getOrCreateConversation(userId);
      const conversation = convertApiConversation(data);

      dispatch({
        type: 'SET_CURRENT_CONVERSATION',
        payload: conversation
      });

      // Update conversations list if needed
      const exists = state.conversations.some(c => c.id === conversation.id);
      if (!exists) {
        dispatch({
          type: 'FETCH_CONVERSATIONS_SUCCESS',
          payload: [...state.conversations, conversation]
        });
      }

      return conversation;
    } catch (error: any) {
      console.error('[useConversations] Error getting conversation:', error);

      if (error.response?.status === 403) {
        toast.error(ERROR_MESSAGES.BLOCKED_USER);
      } else if (error.response?.status === 401) {
        toast.error(ERROR_MESSAGES.UNAUTHORIZED);
      } else {
        toast.error(ERROR_MESSAGES.SERVER_ERROR);
      }

      dispatch({ type: 'SET_ERROR', payload: error });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'conversations', value: false } });
    }
  }, [state.conversations]);

  // Delete (leave) conversation
  const deleteConversation = useCallback(async (conversationId: string) => {
    try {
      await apiClient.deleteConversation(conversationId);

      dispatch({
        type: 'DELETE_CONVERSATION',
        payload: conversationId
      });

      toast.success('Left conversation');
    } catch (error: any) {
      console.error('[useConversations] Error deleting conversation:', error);
      toast.error('Failed to leave conversation');
    }
  }, []);

  // Block user
  const blockUser = useCallback(async (userId: string) => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'blocking', value: true } });

    try {
      await apiClient.blockUser(userId);

      dispatch({
        type: 'ADD_BLOCKED_USER',
        payload: userId
      });

      // Refresh conversations to remove blocked user's conversation
      await fetchConversations();

      toast.success('User blocked');
    } catch (error: any) {
      console.error('[useConversations] Error blocking user:', error);
      toast.error('Failed to block user');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'blocking', value: false } });
    }
  }, [fetchConversations]);

  // Unblock user
  const unblockUser = useCallback(async (userId: string) => {
    dispatch({ type: 'SET_LOADING', payload: { key: 'blocking', value: true } });

    try {
      await apiClient.unblockUser(userId);

      dispatch({
        type: 'REMOVE_BLOCKED_USER',
        payload: userId
      });

      toast.success('User unblocked');
    } catch (error: any) {
      console.error('[useConversations] Error unblocking user:', error);
      toast.error('Failed to unblock user');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: { key: 'blocking', value: false } });
    }
  }, []);

  // Socket event handlers
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    // Handle new message notification (updates conversation list)
    const handleNewMessageNotification = (data: NewMessagePayload) => {
      dispatch({
        type: 'UPDATE_CONVERSATION_LAST_MESSAGE',
        payload: {
          conversationId: data.conversationId,
          message: data.message
        }
      });
    };

    // Handle conversation list refresh (when left conversation gets new message)
    const handleConversationListRefresh = () => {
      console.log('[useConversations] Conversation list refresh triggered');
      fetchConversations();
    };

    // Handle conversation reactivated
    const handleConversationReactivated = (conversationId: string) => {
      console.log('[useConversations] Conversation reactivated:', conversationId);
      // Fetch specific conversation details if needed
      fetchConversations();
    };

    on(SOCKET_EVENTS.MESSAGE_NOTIFICATION, handleNewMessageNotification);
    on(SOCKET_EVENTS.CONVERSATION_LIST_REFRESH, handleConversationListRefresh);
    on(SOCKET_EVENTS.CONVERSATION_REACTIVATED, handleConversationReactivated);

    return () => {
      off(SOCKET_EVENTS.MESSAGE_NOTIFICATION, handleNewMessageNotification);
      off(SOCKET_EVENTS.CONVERSATION_LIST_REFRESH, handleConversationListRefresh);
      off(SOCKET_EVENTS.CONVERSATION_REACTIVATED, handleConversationReactivated);
    };
  }, [connectionStatus, on, off, fetchConversations]);

  // Initial fetch
  useEffect(() => {
    if (user) {
      fetchConversations();
    }

    return () => {
      // Cleanup: abort any pending requests
      abortControllerRef.current?.abort();
    };
  }, [user, fetchConversations]);

  return {
    conversations: state.conversations,
    currentConversation: state.currentConversation,
    isLoading: state.loading.conversations,
    error: state.error,
    fetchConversations,
    getOrCreateConversation,
    deleteConversation,
    blockUser,
    unblockUser
  };
}