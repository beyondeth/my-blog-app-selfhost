import { useEffect } from 'react';
import { useSocketContext } from '@/providers/SocketProvider';
import { useDMStore } from '@/stores/dmStore';
import { useAuth } from '@/providers/AuthProviderV2';

const IS_DEV = process.env.NODE_ENV === 'development';

interface NotificationData {
  conversationId: string;
  message: any;
}

/**
 * Hook for managing DM notifications via WebSocket
 *
 * Replaced SSE with global Socket connection for efficiency.
 * Only listens for 'message-notification' event.
 */
export const useDMNotifications = (enabled: boolean = true) => {
  const { isDMModalOpen, activeConversationId } = useDMStore();
  const { user } = useAuth();
  const { socket, isConnected } = useSocketContext();

  useEffect(() => {
    // Conditions to listen:
    // 1. Hook enabled
    // 2. User authenticated
    // 3. Socket connected
    if (!enabled || !user || !socket || !isConnected) return;

    const handleMessageNotification = (data: NotificationData) => {
      // If modal is open, we might want to suppress toast or handle differently
      // But typically this event is sent only when user is NOT in the chat room
      
      if (IS_DEV) {
        console.log('[DM Notification] Received:', data);
      }

      // Logic for toast or badge update can go here
      // Currently, the backend sends this event only when recipient is NOT in the conversation room.
      // So this is effectively "Unread Message" notification.
    };

    socket.on('message-notification', handleMessageNotification);

    return () => {
      socket.off('message-notification', handleMessageNotification);
    };
  }, [enabled, user, socket, isConnected, isDMModalOpen]);

  return {
    isSSEConnected: isConnected // Backward compatibility name, actually WS status
  };
};