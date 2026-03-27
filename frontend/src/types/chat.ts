/**
 * Chat related type definitions
 * Includes state types, action types, and entity types
 */

import { MessageStatus } from '@/constants/chat';

// Re-export MessageStatus for convenience
export type { MessageStatus } from '@/constants/chat';

// User types
export interface ChatUser {
  id: string;
  username: string;
  profileImage?: string;
  isOnline?: boolean;
  lastSeen?: Date;
}

// Message types
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  /** 메시지 유형: text(일반) | system(자동 생성) | product_card(상품 컨텍스트) */
  messageType?: 'text' | 'system' | 'product_card';
  createdAt: Date;
  updatedAt?: Date;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  sender?: ChatUser;
  status?: MessageStatus;
  tempId?: string; // For optimistic updates
}

// Conversation types
export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  /** 대화 유형: social(소셜 DM) | transaction(거래 채팅) */
  type?: 'social' | 'transaction';
  /** 연결된 주문 ID (거래 채팅 전용) */
  orderId?: string | null;
  /** 연결된 상품 포스트 ID (거래 채팅 전용) */
  productPostId?: string | null;
  user1?: ChatUser;
  user2?: ChatUser;
  lastMessage?: Message;
  lastMessageAt?: Date;
  unreadCount: number;
  user1LastReadAt?: Date | null;
  user2LastReadAt?: Date | null;
  user1DeletedAt?: Date | null;
  user2DeletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** 거래 채팅 컨텍스트 (상단 고정 카드용) */
export interface TransactionContext {
  product: {
    title: string;
    slug: string;
    price: number;
    thumbnailImageId: string | null;
  };
  order: {
    orderId: string;
    status: string;
    amount: number;
    createdAt: string;
  };
  refundStatus?: string;
}

// Loading states
export interface LoadingStates {
  conversations: boolean;
  messages: boolean;
  sending: boolean;
  markingRead: boolean;
  blocking: boolean;
}

// Chat State for useReducer
export interface ChatState {
  // Data
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  optimisticMessages: Map<string, Message>;
  typingUsers: Map<string, boolean>;
  blockedUsers: string[];

  // UI State
  loading: LoadingStates;
  hasMore: boolean;
  error: Error | null;

  // Pagination
  currentPage: number;

  // Socket Connection
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
}

// Action types for useReducer
export type ChatAction =
  // Conversation Actions
  | { type: 'FETCH_CONVERSATIONS_START' }
  | { type: 'FETCH_CONVERSATIONS_SUCCESS'; payload: Conversation[] }
  | { type: 'FETCH_CONVERSATIONS_ERROR'; payload: Error }
  | { type: 'SET_CURRENT_CONVERSATION'; payload: Conversation | null }
  | { type: 'UPDATE_CONVERSATION'; payload: { id: string; updates: Partial<Conversation> } }
  | { type: 'UPDATE_CONVERSATION_LAST_MESSAGE'; payload: { conversationId: string; message: Message } }
  | { type: 'DELETE_CONVERSATION'; payload: string }

  // Message Actions
  | { type: 'FETCH_MESSAGES_START' }
  | { type: 'FETCH_MESSAGES_SUCCESS'; payload: { messages: Message[]; hasMore: boolean; page: number } }
  | { type: 'FETCH_MESSAGES_ERROR'; payload: Error }
  | { type: 'ADD_OPTIMISTIC_MESSAGE'; payload: Message }
  | { type: 'REPLACE_OPTIMISTIC_MESSAGE'; payload: { tempId: string; message: Message } }
  | { type: 'MARK_MESSAGE_FAILED'; payload: { tempId: string } }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; updates: Partial<Message> } }
  | { type: 'DELETE_MESSAGE'; payload: string }
  // 개별 메시지 읽음 처리 제거 - 대화 레벨에서만 관리
  | { type: 'MARK_ALL_MESSAGES_READ'; payload: { conversationId: string } }

  // Typing Actions
  | { type: 'SET_TYPING_USER'; payload: { userId: string; isTyping: boolean } }
  | { type: 'CLEAR_TYPING_USERS' }

  // Block Actions
  | { type: 'SET_BLOCKED_USERS'; payload: string[] }
  | { type: 'ADD_BLOCKED_USER'; payload: string }
  | { type: 'REMOVE_BLOCKED_USER'; payload: string }

  // Connection Actions
  | { type: 'SET_CONNECTION_STATUS'; payload: 'connected' | 'disconnected' | 'reconnecting' }

  // Loading Actions
  | { type: 'SET_LOADING'; payload: { key: keyof LoadingStates; value: boolean } }

  // Error Actions
  | { type: 'SET_ERROR'; payload: Error | null }
  | { type: 'CLEAR_ERROR' }

  // Reset Actions
  | { type: 'RESET_MESSAGES' }
  | { type: 'RESET_STATE' };

// API Response types
export interface ConversationResponse {
  conversations: Conversation[];
  totalCount: number;
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
  totalCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

// WebSocket Event Payloads
export interface NewMessagePayload {
  conversationId: string;
  message: Message;
}

export interface TypingEventPayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessageReadPayload {
  messageId: string;
  userId: string;
  readAt: Date;
}

// Hook Return Types
export interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

export interface UseMessagesReturn {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (messageId: string) => Promise<void>;
  retryMessage: (tempId: string) => Promise<void>;
}

export interface UseSocketManagerReturn {
  socket: any; // Socket.io client type
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler?: (data: any) => void) => void;
}