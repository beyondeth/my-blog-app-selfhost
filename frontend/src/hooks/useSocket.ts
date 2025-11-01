import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/providers/AuthProviderV2';
import { authEvents } from '@/lib/auth/events';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * 토큰 갱신 함수 (Production-Safe)
 *
 * 개선 사항:
 * - 타임아웃 설정 (10초)
 * - Silent failure (프로덕션에서 조용히 실패)
 * - 에러 로깅 환경별 분리
 */
async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      // 타임아웃 10초 (AbortSignal.timeout은 최신 브라우저에서만 지원)
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });

    if (response.ok) {
      // 개발 환경에서만 성공 로그
      if (IS_DEV) {
        console.log('[Socket] Token refreshed');
      }
      return true;
    }

    // 401/403: 정상적인 인증 실패 (로그인 필요)
    if (response.status === 401 || response.status === 403) {
      // 조용히 실패 (사용자에게 알릴 필요 없음)
      return false;
    }

    // 다른 에러: 서버 문제
    if (IS_DEV) {
      console.warn('[Socket] Token refresh failed:', response.status);
    }
    return false;

  } catch (error) {
    // Network error, timeout 등
    // 프로덕션: 완전히 silent
    if (IS_DEV) {
      console.error('[Socket] Token refresh error:', error);
    }
    return false;
  }
}

/**
 * WebSocket Hook (Production-Grade)
 *
 * @param enabled - Socket 연결 활성화 여부 (default: true)
 *
 * 개선 사항:
 * 1. enabled 파라미터로 조건부 연결 제어
 * 2. 재연결 설정 conservative하게 변경 (1회만 시도, 5초 대기)
 * 3. 에러 로깅 환경별 분리 (dev: verbose, prod: silent)
 * 4. Toast 스팸 제거 (사용자 방해 금지)
 * 5. 수동 재연결 로직 제거 (Socket.IO 자동 재연결 사용)
 */
export function useSocket(enabled: boolean = true) {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const isConnecting = useRef(false);

  useEffect(() => {
    // enabled가 false면 연결하지 않음 (채팅 모달이 닫혀있을 때)
    if (!user || !enabled) return;

    // Prevent duplicate connections
    if (isConnecting.current || socketRef.current?.connected) return;

    isConnecting.current = true;

    // Initialize socket connection
    // The JWT token will be sent automatically via httpOnly cookie with withCredentials: true
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';

    if (IS_DEV) {
      console.log('[Socket] Connecting to:', `${socketUrl}/chat`);
    }

    const socket = io(`${socketUrl}/chat`, {
      withCredentials: true,
      transports: ['websocket'], // polling 제거, websocket만 사용
      path: '/socket.io/',

      // 페이지 이동 시에도 연결 유지
      closeOnBeforeunload: false,

      // 자동 재연결 설정 (Conservative)
      reconnection: true,
      reconnectionAttempts: 1, // 1회만 시도 (너무 aggressive하면 에러 스팸)
      reconnectionDelay: 5000, // 5초 대기 (기존 2초 → 5초)
      reconnectionDelayMax: 10000, // 최대 10초
      timeout: 10000, // 연결 타임아웃 10초
    });

    socket.on('connect', () => {
      if (IS_DEV) {
        console.log('[Socket] Connected successfully');
      }
      isConnecting.current = false;
      // 연결 성공 시 Toast 제거 (사용자 방해 금지)
    });

    socket.on('disconnect', (reason) => {
      if (IS_DEV) {
        console.log('[Socket] Disconnected:', reason);
      }
      isConnecting.current = false;

      // 수동 재연결 로직 제거
      // Socket.IO가 reconnection 설정에 따라 자동으로 재시도함
      // 우리가 또 시도하면 중복 재연결로 에러 스팸 발생
    });

    socket.on('connect_error', async (error) => {
      // 프로덕션: 최소한의 로그
      if (IS_DEV) {
        console.error('[Socket] Connection error:', error.message);
      }
      isConnecting.current = false;

      // If auth error, try to refresh token
      if (error.message && error.message.includes('Unauthorized')) {
        if (IS_DEV) {
          console.log('[Socket] Auth error detected, attempting token refresh');
        }
        const refreshed = await refreshToken();

        if (refreshed) {
          // Token refreshed, socket.io will automatically retry
          if (IS_DEV) {
            console.log('[Socket] Token refreshed, waiting for automatic reconnection');
          }
        } else {
          // Token refresh failed, stop trying
          socket.disconnect();
          // Toast 제거 - 프로덕션에서 조용히 실패
        }
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      if (IS_DEV) {
        console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      if (IS_DEV) {
        console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      }
      // Toast 제거 - 사용자 방해 금지
    });

    socket.on('reconnect_failed', () => {
      if (IS_DEV) {
        console.log('[Socket] Reconnection failed');
      }
      // Toast 제거 - 프로덕션에서 조용히 실패
    });

    socketRef.current = socket;

    /**
     * Cleanup 함수 (완벽한 리소스 정리)
     *
     * 1. Socket disconnect
     * 2. 모든 이벤트 리스너 자동 제거 (Socket.IO가 알아서 처리)
     * 3. socketRef null 설정
     * 4. isConnecting 플래그 리셋
     */
    return () => {
      if (socketRef.current) {
        if (IS_DEV) {
          console.log('[Socket] Cleanup: disconnecting socket');
        }
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnecting.current = false;
      }
    };
  }, [user, enabled]); // enabled 의존성 추가, reconnect 제거

  // Listen for auth events
  useEffect(() => {
    // On logout, disconnect socket
    const unsubscribeLogout = authEvents.on('logout', () => {
      console.log('[Socket] Logout event received, disconnecting');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnecting.current = false;
        reconnectAttempts.current = 0;
      }
    });

    // On token refresh, no need to reconnect (cookies are already updated)
    const unsubscribeTokenRefresh = authEvents.on('token-refreshed', () => {
      console.log('[Socket] Token refreshed event received');
      // Socket will use the updated cookies automatically on next request
    });

    // On auth error, disconnect and show error
    const unsubscribeAuthError = authEvents.on('auth-error', (error) => {
      console.log('[Socket] Auth error event received:', error);
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    });

    return () => {
      unsubscribeLogout();
      unsubscribeTokenRefresh();
      unsubscribeAuthError();
    };
  }, []);

  return socketRef.current;
}