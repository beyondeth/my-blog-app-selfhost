import { useCallback, useEffect } from 'react';
import { useSSEConnection } from './useSSEConnection';
import { useDMStore } from '@/stores/dmStore';
import { useAuth } from '@/providers/AuthProviderV2';

const IS_DEV = process.env.NODE_ENV === 'development';

interface NotificationData {
  type: 'new-message' | 'user-typing' | 'user-online' | 'user-offline';
  conversationId?: string;
  userId?: string;
  message?: any;
}

/**
 * Hook for managing DM notifications via SSE (Production-Safe)
 *
 * @param enabled - SSE 연결 활성화 여부 (default: true)
 *
 * 개선 사항:
 * 1. enabled 파라미터로 조건부 연결 제어
 * 2. DM 모달이 열렸을 때만 SSE 연결
 * 3. Toast 스팸 제거
 * 4. 에러 로깅 환경별 분리
 */
export const useDMNotifications = (enabled: boolean = true) => {
  const { isDMModalOpen, activeConversationId } = useDMStore();
  const { user } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  const handleSSEMessage = useCallback((data: NotificationData) => {
    if (IS_DEV) {
      console.log('[DM SSE] Received notification:', data);
    }

    switch (data.type) {
      case 'new-message':
        // New message arrived while DM is open
        // Socket 재연결은 useSocket에서 자동으로 처리함
        // Toast 스팸 제거 (사용자 방해 금지)
        break;

      case 'user-typing':
        // Typing indicator - UI 업데이트만
        break;

      case 'user-online':
      case 'user-offline':
        // User presence changes
        if (IS_DEV) {
          console.log(`[DM SSE] User ${data.userId} is ${data.type === 'user-online' ? 'online' : 'offline'}`);
        }
        break;

      default:
        if (IS_DEV) {
          console.log('[DM SSE] Unknown notification type:', data.type);
        }
    }
  }, []);

  const handleSSEError = useCallback((error: Event) => {
    // 프로덕션: 조용히 실패
    if (IS_DEV) {
      console.error('[DM SSE] Connection error:', error);
    }
    // SSE will auto-reconnect, no need for manual intervention
  }, []);

  const handleSSEOpen = useCallback(() => {
    if (IS_DEV) {
      console.log('[DM SSE] Connection established');
    }
  }, []);

  // Initialize SSE connection
  const { connect, disconnect, isConnected } = useSSEConnection({
    url: `${API_URL}/chat/notifications`,
    onMessage: handleSSEMessage,
    onError: handleSSEError,
    onOpen: handleSSEOpen,
    reconnectDelay: 5000 // 3초 → 5초 (conservative)
  });

  /**
   * SSE 연결 관리 (조건부)
   *
   * enabled && isDMModalOpen && user: 연결
   * 그 외: 연결 해제
   */
  useEffect(() => {
    if (enabled && isDMModalOpen && user) {
      if (IS_DEV) {
        console.log('[DM SSE] Connecting...');
      }
      connect();
    } else {
      if (IS_DEV && (isDMModalOpen || user)) {
        console.log('[DM SSE] Disconnecting...');
      }
      disconnect();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      disconnect();
    };
  }, [enabled, isDMModalOpen, user, connect, disconnect]);

  return {
    isSSEConnected: isConnected
  };
};