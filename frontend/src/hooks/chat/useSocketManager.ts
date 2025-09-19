/**
 * Socket Manager Hook
 * Manages WebSocket connection and event handling
 */

import { useEffect, useCallback, useState } from 'react';
import { useSocket } from '../useSocket';
import { SOCKET_EVENTS } from '@/constants/chat';

export interface UseSocketManagerReturn {
  socket: any;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler?: (data: any) => void) => void;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
}

export function useSocketManager(): UseSocketManagerReturn {
  const socket = useSocket();
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'reconnecting'>('disconnected');

  // Connection status management
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      console.log('[SocketManager] Connected');
      setConnectionStatus('connected');
    };

    const handleDisconnect = () => {
      console.log('[SocketManager] Disconnected');
      setConnectionStatus('disconnected');
    };

    const handleReconnect = () => {
      console.log('[SocketManager] Reconnecting');
      setConnectionStatus('reconnecting');
    };

    const handleError = (error: any) => {
      console.error('[SocketManager] Socket error:', error);
    };

    socket.on(SOCKET_EVENTS.CONNECT, handleConnect);
    socket.on(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
    socket.on(SOCKET_EVENTS.RECONNECT, handleReconnect);
    socket.on(SOCKET_EVENTS.ERROR, handleError);

    // Check initial connection status
    if (socket.connected) {
      setConnectionStatus('connected');
    }

    return () => {
      socket.off(SOCKET_EVENTS.CONNECT, handleConnect);
      socket.off(SOCKET_EVENTS.DISCONNECT, handleDisconnect);
      socket.off(SOCKET_EVENTS.RECONNECT, handleReconnect);
      socket.off(SOCKET_EVENTS.ERROR, handleError);
    };
  }, [socket]);

  // Emit wrapper with connection check
  const emit = useCallback((event: string, data: any) => {
    if (!socket) {
      console.warn('[SocketManager] Socket not available');
      return;
    }

    if (!socket.connected) {
      console.warn('[SocketManager] Socket not connected, queuing event:', event);
      // Socket.io automatically queues events when disconnected
    }

    socket.emit(event, data);
  }, [socket]);

  // Event listener wrapper
  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!socket) {
      console.warn('[SocketManager] Socket not available');
      return;
    }

    socket.on(event, handler);
  }, [socket]);

  // Remove event listener wrapper
  const off = useCallback((event: string, handler?: (data: any) => void) => {
    if (!socket) {
      console.warn('[SocketManager] Socket not available');
      return;
    }

    if (handler) {
      socket.off(event, handler);
    } else {
      socket.off(event);
    }
  }, [socket]);

  // Join conversation room
  const joinConversation = useCallback((conversationId: string) => {
    if (!conversationId) return;

    console.log('[SocketManager] Joining conversation:', conversationId);
    emit(SOCKET_EVENTS.JOIN_CONVERSATION, conversationId);
  }, [emit]);

  // Leave conversation room
  const leaveConversation = useCallback((conversationId: string) => {
    if (!conversationId) return;

    console.log('[SocketManager] Leaving conversation:', conversationId);
    emit(SOCKET_EVENTS.LEAVE_CONVERSATION, conversationId);
  }, [emit]);

  return {
    socket,
    connectionStatus,
    emit,
    on,
    off,
    joinConversation,
    leaveConversation
  };
}