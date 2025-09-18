import { useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/providers/AuthProviderV2';
import toast from 'react-hot-toast';
import { authEvents } from '@/lib/auth-events';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

// 토큰 갱신 함수
async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log('[Socket] Token refreshed successfully');
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Socket] Token refresh failed:', error);
    return false;
  }
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const isConnecting = useRef(false);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 3;

  // 재연결 함수
  const reconnect = useCallback(async () => {
    if (!user || isConnecting.current) return;

    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.log('[Socket] Max reconnection attempts reached');
      toast.error('Chat connection lost. Please refresh the page.');
      return;
    }

    isConnecting.current = true;
    reconnectAttempts.current++;

    console.log(`[Socket] Attempting to reconnect (attempt ${reconnectAttempts.current}/${maxReconnectAttempts})`);

    // 토큰 갱신 시도
    const tokenRefreshed = await refreshToken();

    if (!tokenRefreshed) {
      console.log('[Socket] Token refresh failed, cannot reconnect');
      toast.error('Authentication expired. Please login again.');
      isConnecting.current = false;
      return;
    }

    // 소켓 재연결
    if (socketRef.current) {
      socketRef.current.connect();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    // Prevent duplicate connections
    if (isConnecting.current || socketRef.current?.connected) return;

    isConnecting.current = true;

    // Initialize socket connection
    // The JWT token will be sent automatically via httpOnly cookie with withCredentials: true
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
    console.log('[Socket] Connecting to:', `${socketUrl}/chat`);

    const socket = io(`${socketUrl}/chat`, {
      withCredentials: true,
      transports: ['websocket'], // polling 제거, websocket만 사용
      path: '/socket.io/',

      // 페이지 이동 시에도 연결 유지
      closeOnBeforeunload: false,

      // 자동 재연결 설정
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000,

      // 연결 유지 설정 (Socket.IO가 자동 관리)
      pingInterval: 25000,  // 25초마다 ping
      pingTimeout: 60000,   // 60초 응답 없으면 연결 종료
    });

    socket.on('connect', () => {
      console.log('[Socket] Connected successfully');
      isConnecting.current = false;
      reconnectAttempts.current = 0; // Reset reconnection counter
      toast.success('Chat connected');
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
      isConnecting.current = false;

      // Automatic reconnection for certain disconnect reasons
      if (reason === 'io server disconnect' || reason === 'transport close') {
        // Server disconnected us (possibly due to auth failure)
        setTimeout(() => reconnect(), 2000);
      }
    });

    socket.on('connect_error', async (error) => {
      console.error('[Socket] Connection error:', error.message);
      isConnecting.current = false;

      // If auth error, try to refresh token
      if (error.message && error.message.includes('Unauthorized')) {
        console.log('[Socket] Auth error detected, attempting token refresh');
        const refreshed = await refreshToken();

        if (refreshed) {
          // Token refreshed, socket.io will automatically retry
          console.log('[Socket] Token refreshed, waiting for automatic reconnection');
        } else {
          // Token refresh failed, stop trying
          socket.disconnect();
          toast.error('Authentication expired. Please login again.');
        }
      }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`[Socket] Reconnection attempt ${attemptNumber}`);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      toast.success('Chat reconnected');
    });

    socket.on('reconnect_failed', () => {
      console.log('[Socket] Reconnection failed');
      toast.error('Failed to reconnect to chat. Please refresh the page.');
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnecting.current = false;
        reconnectAttempts.current = 0;
      }
    };
  }, [user, reconnect]);

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