"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/providers/AuthProviderV2';
import { authEvents } from '@/lib/auth/events';
import { getCsrfHeaders } from '@/lib/api/csrf';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocketContext = () => useContext(SocketContext);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * 토큰 갱신 함수 (useSocket과 동일 로직)
 */
async function refreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(await getCsrfHeaders()),
      },
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined,
    });

    if (response.ok) {
      if (IS_DEV) console.log('[SocketProvider] Token refreshed');
      return true;
    }
    return false;
  } catch (error) {
    if (IS_DEV) console.error('[SocketProvider] Token refresh error:', error);
    return false;
  }
}

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, authStatus } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const isConnecting = useRef(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // 0. 인증 확인 중이면 연결 시도하지 않음
    if (authStatus === 'loading') {
      return;
    }

    const ENABLE_SOCKET = false; // DM 기능을 사용하지 않으므로 소켓 연결 비활성화
    const canConnect = ENABLE_SOCKET && authStatus === 'authenticated' && isAuthenticated;

    // 1. 인증되지 않으면 소켓 연결 안 함 (또는 연결 끊기)
    if (!canConnect) {
      if (socketRef.current) {
        if (IS_DEV) console.log('[SocketProvider] User logged out, disconnecting socket');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
        isConnecting.current = false;
      }
      return;
    }

    // 2. 이미 연결 중이거나 연결된 상태면 스킵 (Singleton 보장)
    if (isConnecting.current || socketRef.current?.connected) {
      return;
    }

    isConnecting.current = true;

    // 3. 소켓 연결 시작
    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') || 'http://localhost:3000';
    
    if (IS_DEV) console.log('[SocketProvider] Connecting to:', `${socketUrl}/chat`);

    const newSocket = io(`${socketUrl}/chat`, {
      withCredentials: true,
      transports: ['websocket'],
      path: '/socket.io/',
      closeOnBeforeunload: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    // 4. 이벤트 리스너 등록
    const onConnect = () => {
      if (IS_DEV) console.log('[SocketProvider] Connected successfully');
      setIsConnected(true);
      isConnecting.current = false;
    };

    const onDisconnect = (reason: any) => {
      if (IS_DEV) console.log('[SocketProvider] Disconnected:', reason);
      setIsConnected(false);
      isConnecting.current = false;
      // Socket.IO가 자동 재연결 시도함
    };

    const onConnectError = async (error: Error) => {
      if (IS_DEV) console.error('[SocketProvider] Connection error:', error.message);
      setIsConnected(false);
      isConnecting.current = false;

      // 인증 에러 시 토큰 갱신 시도
      if (error.message && error.message.includes('Unauthorized')) {
        if (IS_DEV) console.log('[SocketProvider] Auth error, attempting token refresh');
        const refreshed = await refreshToken();
        if (refreshed && IS_DEV) {
          console.log('[SocketProvider] Token refreshed, socket should auto-reconnect');
        }
      }
    };

    newSocket.on('connect', onConnect);
    newSocket.on('disconnect', onDisconnect);
    newSocket.on('connect_error', onConnectError);

    setSocket(newSocket);
    socketRef.current = newSocket;

    // 5. Cleanup Function
    return () => {
      // 컴포넌트 언마운트 시엔 연결 끊지 않음 (Layout에서 쓰므로 앱 종료시에만 끊김)
      // 단, useEffect 의존성이 바뀌어서 재실행될 때는 정리 필요
      newSocket.off('connect', onConnect);
      newSocket.off('disconnect', onDisconnect);
      newSocket.off('connect_error', onConnectError);
      
      // user가 null이 되어서 이 cleanup이 불리는 경우엔 위 1번 로직에서 disconnect 처리됨
      // 여기서 강제로 disconnect하면 리렌더링마다 끊겨서 깜빡임 발생할 수 있음
      // 하지만 isConnecting 상태는 초기화해야 함
      isConnecting.current = false;
    };
  }, [authStatus, isAuthenticated, user, socket]); // 인증 상태/사용자 변경 시 실행

  // 로그아웃 이벤트 리스너 (AuthEvents)
  useEffect(() => {
    const handleLogout = () => {
      if (socketRef.current) {
        if (IS_DEV) console.log('[SocketProvider] Logout event, disconnecting');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setIsConnected(false);
      }
    };

    const unsubscribe = authEvents.on('logout', handleLogout);
    return () => unsubscribe();
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
