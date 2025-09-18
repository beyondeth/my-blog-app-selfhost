import { useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from '@/providers/AuthProviderV2';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuth();
  const isConnecting = useRef(false);

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
      transports: ['websocket', 'polling'],
      path: '/socket.io/'
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      isConnecting.current = false;
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      isConnecting.current = false;
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      isConnecting.current = false;
    });

    socketRef.current = socket;

    return () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.disconnect();
        socketRef.current = null;
        isConnecting.current = false;
      }
    };
  }, [user]);

  return socketRef.current;
}