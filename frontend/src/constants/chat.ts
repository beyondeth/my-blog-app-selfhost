/**
 * Chat related constants
 * Defines socket events, message statuses, and other chat-related constants
 */

// Socket Event Names
export const SOCKET_EVENTS = {
  // Connection Events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  RECONNECT: 'reconnect',

  // Room Events
  JOIN_CONVERSATION: 'join-conversation',
  LEAVE_CONVERSATION: 'leave-conversation',
  USER_JOINED: 'user-joined',
  USER_LEFT: 'user-left',

  // Message Events
  NEW_MESSAGE: 'new-message',
  MESSAGE_NOTIFICATION: 'message-notification',
  MESSAGE_READ: 'message-read',
  ALL_MESSAGES_READ: 'all-messages-read',
  MARK_READ: 'mark-read',
  MARK_ALL_READ: 'mark-all-read',

  // Typing Events
  TYPING: 'typing',
  USER_TYPING: 'user-typing',

  // Conversation Events
  CONVERSATION_REACTIVATED: 'conversation-reactivated',
  CONVERSATION_LIST_REFRESH: 'conversation-list-refresh',

  // Error Events
  ERROR: 'error',
  UNAUTHORIZED: 'unauthorized'
} as const;

// Message Status
export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed'
} as const;

// Conversation Status
export const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted'
} as const;

// Pagination
export const CHAT_PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 50,
  DEFAULT_PAGE: 1
} as const;

// Cache Times (in milliseconds)
export const CACHE_TIMES = {
  CONVERSATIONS: 30 * 1000,      // 30 seconds
  MESSAGES: 5 * 60 * 1000,        // 5 minutes
  USER_INFO: 10 * 60 * 1000,      // 10 minutes
  BLOCKED_USERS: 60 * 60 * 1000   // 1 hour
} as const;

// Refetch Intervals (in milliseconds)
export const REFETCH_INTERVALS = {
  CONVERSATIONS_ACTIVE: 10 * 1000,   // 10 seconds when active
  CONVERSATIONS_IDLE: 60 * 1000,     // 1 minute when idle
  UNREAD_COUNT: 30 * 1000            // 30 seconds
} as const;

// UI Constants
export const UI_CONSTANTS = {
  TYPING_INDICATOR_DELAY: 1000,      // 1 second
  SCROLL_THRESHOLD: 100,             // pixels from bottom
  VIRTUAL_SCROLL_THRESHOLD: 50,      // number of items before virtual scrolling
  MESSAGE_MAX_LENGTH: 5000,          // max message length
  TEMP_ID_PREFIX: 'temp-'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  SEND_FAILED: 'Failed to send message',
  CONNECTION_LOST: 'Connection lost. Reconnecting...',
  UNAUTHORIZED: 'Please login to send messages',
  BLOCKED_USER: 'User is blocked',
  CONVERSATION_NOT_FOUND: 'Conversation not found',
  NETWORK_ERROR: 'Network error. Please check your connection',
  SERVER_ERROR: 'Server error. Please try again later'
} as const;

// Type exports for type safety
export type SocketEvent = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
export type MessageStatus = typeof MESSAGE_STATUS[keyof typeof MESSAGE_STATUS];
export type ConversationStatus = typeof CONVERSATION_STATUS[keyof typeof CONVERSATION_STATUS];