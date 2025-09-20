/**
 * 채팅 관련 API 엔드포인트
 * @description DM(다이렉트 메시지) 기능을 위한 실시간 채팅 API
 * WebSocket과 함께 사용되는 REST API 엔드포인트
 */

import type { ApiClient } from '../client';

// @/types/chat에서 타입을 가져오되, API 응답에 맞게 조정
import type {
  Conversation as FrontendConversation,
  Message as FrontendMessage
} from '@/types/chat';

/**
 * API 대화 타입 정의 (백엔드 응답 형식)
 */
export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  user1?: {
    id: string;
    username: string;
    profileImage?: string;
  };
  user2?: {
    id: string;
    username: string;
    profileImage?: string;
  };
  lastMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * API 메시지 타입 정의 (백엔드 응답 형식)
 */
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  tempId?: string; // 낙관적 업데이트용 임시 ID
  // 프론트엔드 타입과 호환을 위한 필드
  isEdited?: boolean;
}

/**
 * 메시지 페이지네이션 응답
 */
export interface MessagesPaginatedResponse {
  messages: Message[];
  hasMore: boolean;
  page: number;
  total: number;
}

/**
 * 차단된 사용자 정보
 */
export interface BlockedUser {
  id: string;
  username: string;
  profileImage?: string;
  blockedAt: string;
}

/**
 * 채팅 API 클래스
 * @description 실시간 채팅 기능을 위한 REST API 메서드 모음
 */
export class ChatAPI {
  constructor(private client: ApiClient) {}

  /**
   * 모든 대화 목록 조회
   * @param signal - 요청 취소를 위한 AbortSignal
   * @returns 사용자의 모든 대화 목록
   * @description 백엔드에서 EXISTS 쿼리로 최적화됨
   */
  async getConversations(signal?: AbortSignal): Promise<Conversation[]> {
    return this.client.get<Conversation[]>('/chat/conversations', { signal });
  }

  /**
   * ID로 특정 대화 조회
   * @param conversationId - 대화 ID
   * @param signal - 요청 취소를 위한 AbortSignal
   * @returns 대화 정보
   */
  async getConversationById(
    conversationId: string,
    signal?: AbortSignal
  ): Promise<Conversation> {
    return this.client.get<Conversation>(
      `/chat/conversation/by-id/${conversationId}`,
      { signal }
    );
  }

  /**
   * 특정 사용자와의 대화 조회 또는 생성
   * @param userId - 대화 상대방 사용자 ID
   * @param signal - 요청 취소를 위한 AbortSignal
   * @returns 기존 대화 또는 새로 생성된 대화
   * @description 대화가 없으면 자동으로 새로 생성
   */
  async getOrCreateConversation(
    userId: string,
    signal?: AbortSignal
  ): Promise<Conversation> {
    return this.client.get<Conversation>(
      `/chat/conversation/${userId}`,
      { signal }
    );
  }

  /**
   * 대화의 메시지 목록 조회 (페이지네이션)
   * @param conversationId - 대화 ID
   * @param page - 페이지 번호 (기본값: 1)
   * @param signal - 요청 취소를 위한 AbortSignal
   * @returns 페이지네이션된 메시지 목록
   */
  async getMessages(
    conversationId: string,
    page: number = 1,
    signal?: AbortSignal
  ): Promise<MessagesPaginatedResponse> {
    return this.client.get<MessagesPaginatedResponse>(
      `/chat/messages/${conversationId}`,
      {
        params: { page },
        signal
      }
    );
  }

  /**
   * 메시지 전송
   * @param conversationId - 대화 ID
   * @param content - 메시지 내용
   * @param tempId - 낙관적 업데이트를 위한 임시 ID
   * @returns 생성된 메시지
   * @description tempId를 사용하여 낙관적 업데이트 구현 가능
   */
  async sendMessage(
    conversationId: string,
    content: string,
    tempId: string
  ): Promise<Message> {
    return this.client.post<Message>('/chat/message', {
      conversationId,
      content,
      tempId
    });
  }

  /**
   * 단일 메시지 읽음 처리
   * @param messageId - 메시지 ID
   * @description 특정 메시지를 읽음으로 표시
   */
  async markMessageAsRead(messageId: string): Promise<void> {
    await this.client.post(`/chat/message/${messageId}/read`);
  }

  /**
   * 대화의 모든 메시지 읽음 처리
   * @param conversationId - 대화 ID
   * @description 대화의 모든 안읽은 메시지를 한번에 읽음 처리
   */
  async markAllMessagesAsRead(conversationId: string): Promise<void> {
    await this.client.post(`/chat/conversation/${conversationId}/mark-all-read`);
  }

  /**
   * 메시지 읽음 처리 (별칭 메서드)
   * @deprecated markMessageAsRead 사용 권장
   */
  async markAsRead(messageId: string): Promise<void> {
    return this.markMessageAsRead(messageId);
  }

  /**
   * 모든 메시지 읽음 처리 (별칭 메서드)
   * @deprecated markAllMessagesAsRead 사용 권장
   */
  async markAllAsRead(conversationId: string): Promise<void> {
    return this.markAllMessagesAsRead(conversationId);
  }

  /**
   * 사용자 차단
   * @param userId - 차단할 사용자 ID
   * @description 차단된 사용자와는 메시지를 주고받을 수 없음
   */
  async blockUser(userId: string): Promise<void> {
    await this.client.post(`/chat/block/${userId}`);
  }

  /**
   * 사용자 차단 해제
   * @param userId - 차단 해제할 사용자 ID
   */
  async unblockUser(userId: string): Promise<void> {
    await this.client.delete(`/chat/block/${userId}`);
  }

  /**
   * 차단된 사용자 목록 조회
   * @param signal - 요청 취소를 위한 AbortSignal
   * @returns 차단된 사용자 목록
   */
  async getBlockedUsers(signal?: AbortSignal): Promise<BlockedUser[]> {
    return this.client.get<BlockedUser[]>('/chat/blocked-users', { signal });
  }

  /**
   * 대화 삭제 (나가기)
   * @param conversationId - 삭제할 대화 ID
   * @description 대화에서 나가기 (상대방의 대화는 유지됨)
   */
  async deleteConversation(conversationId: string): Promise<void> {
    await this.client.delete(`/chat/conversation/${conversationId}`);
  }

  /**
   * 읽지 않은 메시지 개수 조회
   * @param signal - 요청 취소를 위한 AbortSignal
   * @returns 총 읽지 않은 메시지 개수
   * @description 헤더 뱃지 등에 사용
   */
  async getUnreadCount(signal?: AbortSignal): Promise<number> {
    const response = await this.client.get<{ count: number }>(
      '/chat/unread-count',
      { signal }
    );
    return response.count;
  }

  /**
   * 메시지 삭제 (소프트 삭제)
   * @param messageId - 삭제할 메시지 ID
   * @description 메시지를 삭제 표시 (실제로는 유지)
   */
  async deleteMessage(messageId: string): Promise<void> {
    await this.client.delete(`/chat/message/${messageId}`);
  }
}

/**
 * ChatAPI 인스턴스 생성 헬퍼
 * @param client - ApiClient 인스턴스
 * @returns ChatAPI 인스턴스
 */
export function createChatAPI(client: ApiClient): ChatAPI {
  return new ChatAPI(client);
}