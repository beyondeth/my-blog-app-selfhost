import { useCallback, useEffect } from 'react';
import { useSSEConnection } from './useSSEConnection';
import { useSocket } from './useSocket';
import { useDMStore } from '@/stores/dmStore';
import { useAuth } from '@/providers/AuthProviderV2';
import toast from 'react-hot-toast';

interface NotificationData {
  type: 'new-message' | 'user-typing' | 'user-online' | 'user-offline';
  conversationId?: string;
  userId?: string;
  message?: any;
}

/**
 * Hook for managing DM notifications via SSE
 * Automatically connects/disconnects based on DM modal state
 * Handles WebSocket reconnection when messages arrive
 */
export const useDMNotifications = () => {
  const socket = useSocket();
  const { isDMModalOpen, activeConversationId } = useDMStore();
  const { user } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  const handleSSEMessage = useCallback((data: NotificationData) => {
    console.log('[DM SSE] Received notification:', data);

    switch (data.type) {
      case 'new-message':
        // New message arrived while DM is open
        if (isDMModalOpen) {
          // Check if WebSocket is disconnected
          if (!socket?.connected) {
            console.log('[DM SSE] WebSocket disconnected, attempting reconnection...');
            socket?.connect();
          }

          // Show notification if message is for different conversation
          if (data.conversationId && data.conversationId !== activeConversationId) {
            toast('New message received', {
              icon: '💬',
              duration: 3000
            });
          }
        }
        break;

      case 'user-typing':
        // Handle typing indicator via SSE if WebSocket is down
        if (isDMModalOpen && !socket?.connected) {
          // Could update typing state here if needed
        }
        break;

      case 'user-online':
      case 'user-offline':
        // Handle user presence changes
        console.log(`[DM SSE] User ${data.userId} is ${data.type === 'user-online' ? 'online' : 'offline'}`);
        break;

      default:
        console.log('[DM SSE] Unknown notification type:', data.type);
    }
  }, [socket, isDMModalOpen, activeConversationId]);

  const handleSSEError = useCallback((error: Event) => {
    console.error('[DM SSE] Connection error:', error);
    // SSE will auto-reconnect, no need for manual intervention
  }, []);

  const handleSSEOpen = useCallback(() => {
    console.log('[DM SSE] Connection established');
  }, []);

  // Initialize SSE connection
  const { connect, disconnect, isConnected } = useSSEConnection({
    url: `${API_URL}/chat/notifications`,
    onMessage: handleSSEMessage,
    onError: handleSSEError,
    onOpen: handleSSEOpen,
    reconnectDelay: 3000
  });

  // Manage SSE connection based on DM modal state and user authentication
  useEffect(() => {
    if (isDMModalOpen && user) {
      console.log('[DM SSE] DM Modal opened, connecting SSE...');
      connect();
    } else {
      console.log('[DM SSE] DM Modal closed or user not authenticated, disconnecting SSE...');
      disconnect();
    }

    // Cleanup on unmount or when dependencies change
    return () => {
      disconnect();
    };
  }, [isDMModalOpen, user, connect, disconnect]);

  // Check WebSocket status periodically when DM is open
  useEffect(() => {
    if (!isDMModalOpen || !socket) return;

    const checkInterval = setInterval(() => {
      if (!socket.connected && isConnected()) {
        console.log('[DM SSE] WebSocket disconnected but SSE active, considering reconnection...');
        // Don't auto-reconnect WebSocket here, wait for actual message
        // This prevents unnecessary reconnection attempts
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(checkInterval);
  }, [isDMModalOpen, socket, isConnected]);

  return {
    isSSEConnected: isConnected
  };
};