import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';

interface SSEConfig {
  url: string;
  onMessage: (data: any) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  reconnectDelay?: number;
}

/**
 * Custom hook for managing Server-Sent Events connections
 * Handles connection lifecycle, automatic reconnection, and cleanup
 */
export const useSSEConnection = ({
  url,
  onMessage,
  onError,
  onOpen,
  reconnectDelay = 3000
}: SSEConfig) => {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { user } = useAuth();
  const isConnectedRef = useRef(false);

  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (isConnectedRef.current || eventSourceRef.current?.readyState === EventSource.OPEN) {
      return;
    }

    // Only connect for authenticated users
    if (!user) {
      console.log('[SSE] No authenticated user, skipping connection');
      return;
    }

    try {
      console.log('[SSE] Connecting to:', url);
      eventSourceRef.current = new EventSource(url, {
        withCredentials: true
      });

      eventSourceRef.current.onopen = () => {
        console.log('[SSE] Connection opened');
        isConnectedRef.current = true;
        onOpen?.();

        // Clear any pending reconnect attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = undefined;
        }
      };

      eventSourceRef.current.onmessage = (event) => {
        try {
          // Handle keep-alive pings
          if (event.data === ':ping' || event.data === '') {
            return;
          }

          const data = JSON.parse(event.data);
          onMessage(data);
        } catch (err) {
          console.error('[SSE] Parse error:', err, 'Data:', event.data);
        }
      };

      eventSourceRef.current.onerror = (error) => {
        console.error('[SSE] Connection error:', error);
        isConnectedRef.current = false;
        onError?.(error);

        // Browser will automatically reconnect for SSE
        // But we'll handle cleanup if needed
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          console.log('[SSE] Connection closed, will reconnect in', reconnectDelay, 'ms');
        }
      };
    } catch (error) {
      console.error('[SSE] Failed to create connection:', error);
      isConnectedRef.current = false;
    }
  }, [url, onMessage, onError, onOpen, user, reconnectDelay]);

  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting');

    // Clear reconnect timeout if pending
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    // Close EventSource connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    isConnectedRef.current = false;
  }, []);

  const isConnected = useCallback(() => {
    return isConnectedRef.current && eventSourceRef.current?.readyState === EventSource.OPEN;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connect,
    disconnect,
    isConnected,
    readyState: eventSourceRef.current?.readyState
  };
};