/**
 * Chat API Response Converters
 * Converts API response types to frontend types
 */

import type {
  Conversation as ApiConversation,
  Message as ApiMessage,
} from '../endpoints/chat';
import type {
  Conversation as FrontendConversation,
  Message as FrontendMessage,
  ChatUser,
} from '@/types/chat';

/**
 * Convert API message to frontend message type
 */
export function convertApiMessage(apiMessage: ApiMessage): FrontendMessage {
  return {
    id: apiMessage.id,
    conversationId: apiMessage.conversationId,
    senderId: apiMessage.senderId,
    content: apiMessage.content,
    createdAt: new Date(apiMessage.createdAt),
    updatedAt: apiMessage.updatedAt ? new Date(apiMessage.updatedAt) : undefined,
    // isRead, readAt 제거 - 대화 레벨에서만 읽음 상태 관리
    isEdited: apiMessage.isEdited || false,
    editedAt: undefined, // API doesn't provide this
    isDeleted: apiMessage.isDeleted,
    deletedAt: undefined, // API doesn't provide this
    sender: undefined, // Will be populated separately if needed
    status: undefined, // Will be set by the frontend
    tempId: apiMessage.tempId,
  };
}

/**
 * Convert API conversation to frontend conversation type
 */
export function convertApiConversation(apiConv: ApiConversation): FrontendConversation {
  // Convert user1 and user2 to ChatUser format
  const user1Data: ChatUser | undefined = apiConv.user1 ? {
    id: apiConv.user1.id,
    username: apiConv.user1.username,
    profileImage: apiConv.user1.profileImage,
    isOnline: undefined,
    lastSeen: undefined,
  } : undefined;

  const user2Data: ChatUser | undefined = apiConv.user2 ? {
    id: apiConv.user2.id,
    username: apiConv.user2.username,
    profileImage: apiConv.user2.profileImage,
    isOnline: undefined,
    lastSeen: undefined,
  } : undefined;

  return {
    id: apiConv.id,
    user1Id: apiConv.user1Id,
    user2Id: apiConv.user2Id,
    user1: user1Data,
    user2: user2Data,
    lastMessage: apiConv.lastMessage ? {
      id: '', // API doesn't provide message ID in lastMessage
      conversationId: apiConv.id,
      senderId: apiConv.lastMessage.senderId,
      content: apiConv.lastMessage.content,
      createdAt: new Date(apiConv.lastMessage.createdAt),
      updatedAt: undefined,
      // isRead, readAt 제거 - 대화 레벨에서만 읽음 상태 관리
      isEdited: false,
      editedAt: undefined,
      isDeleted: false,
      deletedAt: undefined,
      sender: undefined,
      status: undefined,
      tempId: undefined,
    } : undefined,
    lastMessageAt: apiConv.lastMessage ? new Date(apiConv.lastMessage.createdAt) : undefined,
    unreadCount: apiConv.unreadCount,
    user1DeletedAt: null,
    user2DeletedAt: null,
    createdAt: new Date(apiConv.createdAt),
    updatedAt: new Date(apiConv.updatedAt),
  };
}

/**
 * Convert messages response
 */
export function convertMessagesResponse(apiResponse: {
  messages: ApiMessage[];
  hasMore: boolean;
  page?: number;
  total?: number;
}) {
  return {
    messages: apiResponse.messages.map(convertApiMessage),
    hasMore: apiResponse.hasMore,
    page: apiResponse.page || 1,
    total: apiResponse.total,
  };
}

/**
 * Convert conversations array
 */
export function convertConversations(apiConversations: ApiConversation[]): FrontendConversation[] {
  return apiConversations.map(convertApiConversation);
}