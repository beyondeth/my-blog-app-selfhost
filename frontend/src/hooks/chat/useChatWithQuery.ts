/**
 * Chat Hook with React Query Integration
 * Combines refactored chat functionality with React Query for optimal caching and state management
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/providers/AuthProviderV2';
import {
  useConversationsQuery,
  useConversationByIdQuery,
  useMessagesInfiniteQuery,
  useCreateConversationMutation,
  useSendMessageMutation,
  // useMarkAsReadMutation 제거 - 개별 메시지 읽음 처리 제거
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

  /**
   * 채팅방 포커스 상태 관리
   * - 브라우저 탭 전환, 창 포커스, 채팅방 진입/퇴출 추적
   * - React state로 관리하여 렌더링과 동기화
   */
  const [isInChatRoom, setIsInChatRoom] = useState(false);
  const isInChatRoomRef = useRef(isInChatRoom);

  useEffect(() => {
    isInChatRoomRef.current = isInChatRoom;
  }, [isInChatRoom]);
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);

  /**
   * 브라우저 탭 전환 감지 - React state로 관리
   * - 탭이 숨겨지면: 채팅방에서 자동으로 나감 (읽지 않은 메시지 카운트 시작)
   * - 탭이 다시 보이면: 채팅방에 자동으로 재입장 (읽지 않은 메시지 0으로 리셋)
   * - DOM 직접 조작 대신 state 사용하여 React 렌더링 사이클과 동기화
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const hidden = document.hidden;
      setIsTabVisible(!hidden);

      if (!socket || !conversationId) return;

      if (hidden) {
        // 탭을 벗어남: 채팅방에서 나감 처리
        console.log('[채팅] 탭 전환됨 - 채팅방 나감:', conversationId);
        socket.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, conversationId);
        setIsInChatRoom(false);
      } else {
        // 탭으로 돌아옴: 채팅방 재입장
        console.log('[채팅] 탭 복귀 - 채팅방 재입장:', conversationId);
        socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);
        setIsInChatRoom(true);

        // 대화 목록 새로고침하여 최신 unreadCount 반영
        queryClient.invalidateQueries({
          queryKey: CHAT_QUERY_KEYS.conversations()
        });
      }
    };

    // 이벤트 리스너 등록
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 컴포넌트 마운트 시 초기 상태 설정
    setIsTabVisible(!document.hidden);

    // 클린업: 이벤트 리스너 제거
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [socket, conversationId, queryClient]);

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

  // Flatten messages from all pages and ensure chronological order
  const messages = useMemo(() => {
    if (!messagesData?.pages) return [];

    const allMessages = messagesData.pages.flatMap(page => {
      // Add safety check for page structure
      if (!page || !Array.isArray(page.messages)) return [];
      return page.messages;
    });

    // Sort messages by creation time (oldest first) to ensure correct order
    // This prevents issues when messages are loaded out of order
    return allMessages.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateA - dateB;
    });
  }, [messagesData]);

  // Mutations
  const createConversationMutation = useCreateConversationMutation();
  const sendMessageMutation = useSendMessageMutation(conversationId || '', user?.id);
  // markAsReadMutation 제거 - 개별 메시지 읽음 처리 제거
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

  /**
   * 채팅 상대방의 실시간 채팅방 입장 상태
   * - true: 상대방이 현재 이 채팅방에 있음 (메시지 즉시 읽음 처리)
   * - false: 상대방이 채팅방에 없음 (읽지 않은 메시지 카운트 증가)
   */
  const [otherUserInRoom, setOtherUserInRoom] = useState(false);

  /**
   * 채팅방 입장 시 초기화 작업
   * 1. 오래된 메시지 캐시 갱신 (필요시)
   * 2. UI의 읽지 않은 메시지 수 즉시 0으로 리셋
   * 3. 백엔드는 join-conversation 이벤트 받으면 자동으로 lastReadAt 업데이트
   *
   * 주의: mark-all-read API를 별도로 호출하지 않음 (중복 방지)
   * 백엔드가 join 이벤트에서 이미 처리하므로 프론트는 UI만 업데이트
   */
  useEffect(() => {
    if (!conversationId) return;

    console.log('[채팅] 대화방 입장:', conversationId);
    setIsInChatRoom(true);

    // 1. 메시지 캐시 갱신 (staleTime 지난 경우만)
    queryClient.invalidateQueries({
      queryKey: CHAT_QUERY_KEYS.messages(conversationId),
      exact: true,
      refetchType: 'active' // 화면에 보이는 쿼리만 갱신
    });

    // 2. 대화 목록의 unreadCount를 즉시 0으로 (UI 반응성)
    // 채팅방에 들어가면 무조건 0으로 리셋
    queryClient.setQueryData<Conversation[]>(
      CHAT_QUERY_KEYS.conversations(),
      (old) => {
        if (!old || !Array.isArray(old)) return [];
        return old.map(conv => {
          if (conv.id === conversationId) {
            console.log('[채팅] 🔄 읽지 않은 메시지 리셋:', conv.id, '이전:', conv.unreadCount, '-> 0');
            return { ...conv, unreadCount: 0 };
          }
          return conv;
        });
      }
    );

    // 3. 현재 대화방의 unreadCount도 명시적으로 0으로 설정
    queryClient.setQueryData<Conversation>(
      CHAT_QUERY_KEYS.conversation(conversationId),
      (old) => {
        if (!old) return old;
        console.log('[채팅] 🔄 현재 대화방 unreadCount 리셋:', old.unreadCount, '-> 0');
        return { ...old, unreadCount: 0 };
      }
    );

    // 클린업: 채팅방 나갈 때 상태 업데이트
    return () => {
      console.log('[채팅] 대화방 뷰 나감 (unreadCount는 유지):', conversationId);
      setIsInChatRoom(false);
    };
  }, [conversationId, queryClient]);

  /**
   * 채팅방 입장/퇴장 Socket 이벤트 관리
   * - 채팅방 전환 시 이전 방에서 나가고 새 방 입장
   * - Socket 재연결 시 자동으로 현재 채팅방 재입장
   * - useRef 대신 state로 관리하여 React 패턴 준수
   */
  const [prevConversationId, setPrevConversationId] = useState<string | undefined>();

  useEffect(() => {
    if (!socket) return;

    // 이전 채팅방과 다르면 나가고 새로 입장
    if (prevConversationId && prevConversationId !== conversationId) {
      console.log('[채팅] 이전 대화방 나감:', prevConversationId);
      socket.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, prevConversationId);
    }

    // 새 채팅방 입장
    if (conversationId && conversationId !== prevConversationId) {
      console.log('[채팅] 새 대화방 입장:', conversationId);
      socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);
      setPrevConversationId(conversationId);
    }

    /**
     * Socket 재연결 핸들러
     * - 네트워크 끊김 후 재연결 시 자동으로 채팅방 재입장
     * - 사용자는 수동으로 다시 입장할 필요 없음
     */
    const handleReconnect = () => {
      if (conversationId && isInChatRoom && isTabVisible) {
        console.log('[채팅] Socket 재연결 - 대화방 재입장:', conversationId);
        socket.emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);
      }
    };

    socket.on('connect', handleReconnect);

    // 클린업: 컴포넌트 언마운트 시 채팅방 나가기
    return () => {
      if (conversationId) {
        console.log('[채팅] 클린업 - 대화방 나감:', conversationId);
        socket.emit(SOCKET_EVENTS.LEAVE_CONVERSATION, conversationId);
      }
      socket.off('connect', handleReconnect);
    };
  }, [socket, conversationId, prevConversationId, isInChatRoom, isTabVisible]);

  /**
   * Socket 이벤트 핸들러 - React Query와 통합
   * 실시간 메시지, 읽음 처리, 타이핑 표시 등 모든 실시간 이벤트 처리
   */
  useEffect(() => {
    if (!socket) return;

    /**
     * 새 메시지 수신 핸들러
     * - 현재 채팅방의 메시지만 처리
     * - 내가 보낸 메시지는 건너뜀 (이미 optimistic update로 추가됨)
     * - 채팅방에 있으면 unreadCount 0 유지, 없으면 증가
     */
    const handleNewMessage = (message: Message) => {
      // 현재 채팅방의 메시지만 처리
      if (message.conversationId !== conversationId) return;

      // 내가 보낸 메시지는 이미 처리됨
      if (message.senderId === user?.id) return;

      console.log('[채팅] 💬 새 메시지 수신:', {
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        isInChatRoom: isInChatRoomRef.current
      });

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

        /**
         * 대화 목록 업데이트
         * - 현재 채팅방: unreadCount 항상 0 (백엔드에서 lastReadAt 자동 업데이트)
         * - 다른 채팅방: 이 핸들러가 호출되지 않음 (message-notification 이벤트로 처리)
         * - isInChatRoom state로 이중 체크
         */
        queryClient.setQueryData<Conversation[]>(
          CHAT_QUERY_KEYS.conversations(),
          (old) => {
            if (!old || !Array.isArray(old)) return [];
            return old.map(conv => {
              if (conv.id === message.conversationId) {
                // 채팅방에 있으면 무조건 0
                const newUnreadCount = isInChatRoomRef.current ? 0 : (conv.unreadCount || 0);
                console.log('[채팅] 🔄 현재 방 새 메시지 - unreadCount:', newUnreadCount, 'isInChatRoom:', isInChatRoomRef.current);
                return {
                  ...conv,
                  lastMessage: message,
                  lastMessageAt: message.createdAt,
                  unreadCount: newUnreadCount
                };
              }
              return conv;
            });
          }
        );
      });
    };

    /**
     * 개별 메시지 읽음 처리 (현재 미사용)
     * - lastReadAt 방식으로 변경되어 개별 메시지 읽음 추적 안함
     * - 하위 호환성을 위해 핸들러는 유지
     */
    const handleMessageRead = ({
      messageId,
      conversationId: msgConvId,
      readBy,
    }: {
      messageId: string;
      conversationId: string;
      readBy: string;
    }) => {
      console.log('[채팅] 메시지 읽음 이벤트 (레거시) - lastReadAt 방식에서는 무시');
    };

    /**
     * 모든 메시지 읽음 처리
     * - 상대방이 내 메시지를 모두 읽었을 때 호출
     * - lastReadAt 방식이므로 unreadCount만 0으로 리셋
     */
    const handleAllMessagesRead = ({
      conversationId: msgConvId,
      readBy,
    }: {
      conversationId: string;
      readBy: string;
    }) => {
      // 상대방이 읽은 경우만 처리
      if (readBy !== user?.id) {
        console.log('[채팅] 모든 메시지 읽음 - unreadCount 초기화:', msgConvId);

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

    /**
     * 타이핑 표시 처리
     * - 상대방이 타이핑 중일 때 표시
     * - 일정 시간 후 자동으로 숨김 (3초)
     * - React Query 캐시를 사용하여 상태 관리
     */
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
      // 현재 채팅방의 상대방 타이핑만 처리
      if (typingConvId === conversationId && userId !== user?.id) {
        const key = `typing-${userId}`;

        // Clear existing timeout
        const existingTimeout = typingTimeouts.get(key);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }

        if (isTyping) {
          // 타이핑 표시 시작
          queryClient.setQueryData<string | null>(
            ['chat', 'typing', conversationId],
            userId
          );

          // 3초 후 자동으로 타이핑 표시 제거
          const timeout = setTimeout(() => {
            queryClient.setQueryData<string | null>(
              ['chat', 'typing', conversationId],
              null
            );
            typingTimeouts.delete(key);
          }, UI_CONSTANTS.TYPING_INDICATOR_DELAY * 3);

          typingTimeouts.set(key, timeout);
        } else {
          // 타이핑 종료 - 즉시 숨김
          queryClient.setQueryData<string | null>(
            ['chat', 'typing', conversationId],
            null
          );
        }
      }
    };

    /**
     * 다른 채팅방 메시지 알림 처리
     * - 현재 열려있지 않은 채팅방에 새 메시지가 왔을 때
     * - 백엔드가 상대방이 채팅방에 없을 때만 이 이벤트 발생
     * - unreadCount 증가 및 메시지 캐시 업데이트
     */
    const handleMessageNotification = ({
      conversationId: msgConvId,
      message,
    }: {
      conversationId: string;
      message: Message;
    }) => {
      // 현재 채팅방의 알림은 무시 (백엔드 버그 방어)
      // isInChatRoom state도 확인하여 이중 체크
      if (msgConvId === conversationId || (msgConvId === conversationId && isInChatRoomRef.current)) {
        console.log('[채팅] ⚠️ 경고: 현재 방 메시지 알림 받음 - 무시', {
          msgConvId,
          currentConvId: conversationId,
          isInChatRoom: isInChatRoomRef.current,
          같은방: msgConvId === conversationId
        });

        // 현재 채팅방이면 unreadCount를 강제로 0으로 유지
        queryClient.setQueryData<Conversation[]>(
          CHAT_QUERY_KEYS.conversations(),
          (old) => {
            if (!old || !Array.isArray(old)) return [];
            return old.map(conv => {
              if (conv.id === msgConvId && conv.id === conversationId) {
                console.log('[채팅] 🛡️ 현재 채팅방 unreadCount 강제 0 유지');
                return {
                  ...conv,
                  lastMessage: message,
                  lastMessageAt: message.createdAt,
                  unreadCount: 0  // 무조건 0
                };
              }
              return conv;
            });
          }
        );
        return;
      }

      console.log('[채팅] 📬 다른 대화방 메시지 알림:', msgConvId);

      /**
       * 메시지 캐시 업데이트
       * - 채팅방이 닫혀있어도 캐시 업데이트
       * - 나중에 채팅방 열면 최신 메시지 즉시 표시
       */
      queryClient.setQueryData<MessagesInfiniteData>(
        CHAT_QUERY_KEYS.messages(msgConvId),
        (oldData) => {
          if (!oldData?.pages || oldData.pages.length === 0) {
            // 캐시가 없으면 새로 생성 (나중에 채팅방 열 때 사용)
            return {
              pages: [{
                messages: [message],
                hasMore: true,
                page: 1
              }],
              pageParams: [1]
            };
          }

          // 중복 체크
          const exists = oldData.pages.some(page =>
            page.messages.some((m: Message) => m.id === message.id)
          );
          if (exists) return oldData;

          // Add new message to the first page
          return addMessageToInfiniteCache(oldData, message);
        }
      );

      /**
       * 대화 목록 업데이트
       * - 다른 채팅방의 unreadCount 증가
       * - 내가 보낸 메시지는 카운트하지 않음
       */
      queryClient.setQueryData<Conversation[]>(
        CHAT_QUERY_KEYS.conversations(),
        (old) => {
          if (!old || !Array.isArray(old)) return [];
          return old.map(conv => {
            if (conv.id === msgConvId) {
              // 상대방이 보낸 메시지만 카운트
              const shouldIncrement = message.senderId !== user?.id;
              const newUnreadCount = shouldIncrement
                ? (conv.unreadCount || 0) + 1
                : (conv.unreadCount || 0);

              console.log('[채팅] 메시지 알림 처리:', {
                대화방: msgConvId,
                발신자: message.senderId,
                현재사용자: user?.id,
                카운트증가: shouldIncrement,
                이전카운트: conv.unreadCount,
                새카운트: newUnreadCount
              });

              return {
                ...conv,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                unreadCount: newUnreadCount
              };
            }
            return conv;
          });
        }
      );
    };

    /**
     * 대화 재활성화 처리
     * - 삭제됐던 대화가 다시 활성화될 때
     */
    const handleConversationReactivated = () => {
      invalidateConversations();
    };

    /**
     * 상대방 채팅방 입장 알림
     * - 상대방이 이 채팅방에 들어왔을 때
     * - 실시간으로 메시지 읽음 처리 가능
     */
    const handleUserJoined = ({ conversationId: joinedConvId, userId: joinedUserId }: { conversationId: string; userId: string }) => {
      if (joinedConvId === conversationId && joinedUserId !== user?.id) {
        console.log('[채팅] 상대방 입장');
        setOtherUserInRoom(true);
      }
    };

    /**
     * 상대방 채팅방 퇴장 알림
     * - 상대방이 채팅방을 나갔을 때
     * - 이후 메시지는 읽지 않은 것으로 처리
     */
    const handleUserLeft = ({ conversationId: leftConvId, userId: leftUserId }: { conversationId: string; userId: string }) => {
      if (leftConvId === conversationId && leftUserId !== user?.id) {
        console.log('[채팅] 상대방 퇴장');
        setOtherUserInRoom(false);
      }
    };

    /**
     * 대화 목록 갱신 요청
     * - 서버에서 대화 목록 업데이트가 필요할 때
     * - 나간 대화방에 새 메시지가 왔을 때 등
     */
    const handleConversationListRefresh = () => {
      console.log('[채팅] 대화 목록 갱신 이벤트');

      // 대화 목록 새로고침
      queryClient.invalidateQueries({
        queryKey: CHAT_QUERY_KEYS.conversations()
      });

      // 현재 채팅방 메시지도 무효화 (자동 refetch는 안함)
      if (conversationId) {
        queryClient.invalidateQueries({
          queryKey: CHAT_QUERY_KEYS.messages(conversationId),
          refetchType: 'none'
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

      // 타이핑 타임아웃 모두 정리
      typingTimeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [socket, user?.id, queryClient, measurePerformance, invalidateConversations, conversationId]);

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
    // 개별 메시지 읽음 처리 제거 - 대화 레벨에서만 관리
    console.log('[useChatWithQuery] Individual message read tracking removed');
  }, []);

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