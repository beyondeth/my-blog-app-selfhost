/**
 * Chat Reducer
 * Centralized state management for chat functionality
 */

import { ChatState, ChatAction, Message, Conversation } from '@/types/chat';
import { MESSAGE_STATUS } from '@/constants/chat';

// Initial state
export const initialChatState: ChatState = {
  // Data
  conversations: [],
  currentConversation: null,
  messages: [],
  optimisticMessages: new Map(),
  typingUsers: new Map(),
  blockedUsers: [],

  // UI State
  loading: {
    conversations: false,
    messages: false,
    sending: false,
    markingRead: false,
    blocking: false
  },
  hasMore: true,
  error: null,

  // Pagination
  currentPage: 1,

  // Socket Connection
  connectionStatus: 'disconnected'
};

// Helper functions
const updateConversationInList = (
  conversations: Conversation[],
  conversationId: string,
  updates: Partial<Conversation>
): Conversation[] => {
  return conversations.map(conv =>
    conv.id === conversationId
      ? { ...conv, ...updates }
      : conv
  );
};

const updateMessageInList = (
  messages: Message[],
  messageId: string,
  updates: Partial<Message>
): Message[] => {
  return messages.map(msg =>
    msg.id === messageId
      ? { ...msg, ...updates }
      : msg
  );
};

// Main reducer function
export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    // ========== Conversation Actions ==========
    case 'FETCH_CONVERSATIONS_START':
      return {
        ...state,
        loading: { ...state.loading, conversations: true },
        error: null
      };

    case 'FETCH_CONVERSATIONS_SUCCESS':
      return {
        ...state,
        conversations: action.payload,
        loading: { ...state.loading, conversations: false },
        error: null
      };

    case 'FETCH_CONVERSATIONS_ERROR':
      return {
        ...state,
        loading: { ...state.loading, conversations: false },
        error: action.payload
      };

    case 'SET_CURRENT_CONVERSATION':
      return {
        ...state,
        currentConversation: action.payload
      };

    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: updateConversationInList(
          state.conversations,
          action.payload.id,
          action.payload.updates
        ),
        currentConversation: state.currentConversation?.id === action.payload.id
          ? { ...state.currentConversation, ...action.payload.updates }
          : state.currentConversation
      };

    case 'UPDATE_CONVERSATION_LAST_MESSAGE': {
      const { conversationId, message } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map(conv =>
          conv.id === conversationId
            ? {
                ...conv,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                // Reset unread count if it's our message
                unreadCount: message.senderId === state.currentConversation?.user1Id ||
                            message.senderId === state.currentConversation?.user2Id
                  ? 0
                  : conv.unreadCount
              }
            : conv
        ).sort((a, b) => {
          // Sort by last message time (newest first)
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime;
        })
      };
    }

    case 'DELETE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter(conv => conv.id !== action.payload),
        currentConversation: state.currentConversation?.id === action.payload
          ? null
          : state.currentConversation
      };

    // ========== Message Actions ==========
    case 'FETCH_MESSAGES_START':
      return {
        ...state,
        loading: { ...state.loading, messages: true },
        error: null
      };

    case 'FETCH_MESSAGES_SUCCESS': {
      const { messages, hasMore, page } = action.payload;
      return {
        ...state,
        messages: page === 1
          ? messages
          : [...messages, ...state.messages], // Prepend for pagination
        hasMore,
        currentPage: page,
        loading: { ...state.loading, messages: false },
        error: null
      };
    }

    case 'FETCH_MESSAGES_ERROR':
      return {
        ...state,
        loading: { ...state.loading, messages: false },
        error: action.payload
      };

    case 'ADD_OPTIMISTIC_MESSAGE': {
      const optimisticMessage = action.payload;
      const newOptimisticMessages = new Map(state.optimisticMessages);
      newOptimisticMessages.set(optimisticMessage.id, optimisticMessage);

      return {
        ...state,
        messages: [...state.messages, optimisticMessage],
        optimisticMessages: newOptimisticMessages,
        loading: { ...state.loading, sending: true },
        // Update conversation's last message optimistically
        conversations: updateConversationInList(
          state.conversations,
          optimisticMessage.conversationId,
          {
            lastMessage: optimisticMessage,
            lastMessageAt: optimisticMessage.createdAt,
            unreadCount: 0 // Reset since we're sending
          }
        )
      };
    }

    case 'REPLACE_OPTIMISTIC_MESSAGE': {
      const { tempId, message } = action.payload;
      const newOptimisticMessages = new Map(state.optimisticMessages);
      newOptimisticMessages.delete(tempId);

      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === tempId
            ? { ...message, status: MESSAGE_STATUS.SENT as any }
            : msg
        ),
        optimisticMessages: newOptimisticMessages,
        loading: { ...state.loading, sending: false }
      };
    }

    case 'MARK_MESSAGE_FAILED': {
      const { tempId } = action.payload;
      return {
        ...state,
        messages: updateMessageInList(
          state.messages,
          tempId,
          { status: MESSAGE_STATUS.FAILED as any }
        ),
        loading: { ...state.loading, sending: false }
      };
    }

    case 'ADD_MESSAGE': {
      const newMessage = action.payload;
      // Check if message already exists (prevent duplicates)
      const exists = state.messages.some(msg => msg.id === newMessage.id);
      if (exists) {
        return state;
      }

      return {
        ...state,
        messages: [...state.messages, newMessage]
      };
    }

    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: updateMessageInList(
          state.messages,
          action.payload.id,
          action.payload.updates
        )
      };

    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.filter(msg => msg.id !== action.payload)
      };

    // 개별 메시지 읽음 처리 제거 - 대화 레벨에서만 관리

    case 'MARK_ALL_MESSAGES_READ':
      return {
        ...state,
        // 개별 메시지 업데이트 제거 - 대화 레벨에서만 관리
        conversations: updateConversationInList(
          state.conversations,
          action.payload.conversationId,
          { unreadCount: 0 }
        )
      };

    // ========== Typing Actions ==========
    case 'SET_TYPING_USER': {
      const { userId, isTyping } = action.payload;
      const newTypingUsers = new Map(state.typingUsers);

      if (isTyping) {
        newTypingUsers.set(userId, true);
      } else {
        newTypingUsers.delete(userId);
      }

      return {
        ...state,
        typingUsers: newTypingUsers
      };
    }

    case 'CLEAR_TYPING_USERS':
      return {
        ...state,
        typingUsers: new Map()
      };

    // ========== Block Actions ==========
    case 'SET_BLOCKED_USERS':
      return {
        ...state,
        blockedUsers: action.payload
      };

    case 'ADD_BLOCKED_USER':
      return {
        ...state,
        blockedUsers: [...state.blockedUsers, action.payload]
      };

    case 'REMOVE_BLOCKED_USER':
      return {
        ...state,
        blockedUsers: state.blockedUsers.filter(id => id !== action.payload)
      };

    // ========== Connection Actions ==========
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload
      };

    // ========== Loading Actions ==========
    case 'SET_LOADING':
      return {
        ...state,
        loading: {
          ...state.loading,
          [action.payload.key]: action.payload.value
        }
      };

    // ========== Error Actions ==========
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };

    // ========== Reset Actions ==========
    case 'RESET_MESSAGES':
      return {
        ...state,
        messages: [],
        optimisticMessages: new Map(),
        hasMore: true,
        currentPage: 1
      };

    case 'RESET_STATE':
      return initialChatState;

    default:
      return state;
  }
};