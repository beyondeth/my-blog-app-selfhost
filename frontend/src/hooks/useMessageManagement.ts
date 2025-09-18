import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useChat } from './useChat';
import { Message } from '@/components/dm/DMLayout/DMLayout.types';

interface MessageGroup {
  senderId: string;
  messages: Message[];
  timestamp: Date;
}

interface UseMessageManagementReturn {
  groupedMessages: MessageGroup[];
  isLoading: boolean;
  isSending: boolean;
  hasMore: boolean;
  sendMessage: (content: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  markAsRead: (messageId: string) => void;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  scrollToBottom: (smooth?: boolean) => void;
}

export function useMessageManagement(conversationId: string): UseMessageManagementReturn {
  const {
    messages,
    loading,
    hasMore,
    sendMessage: sendChatMessage,
    retryMessage: retryChatMessage,
    markAsRead: markChatAsRead,
    fetchMessages,
  } = useChat(conversationId);

  const [isSending, setIsSending] = useState(false);
  const [page, setPage] = useState(1);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(true);
  const lastMessageCountRef = useRef(0);

  // Group consecutive messages from the same sender
  const groupedMessages = useMemo((): MessageGroup[] => {
    const groups: MessageGroup[] = [];
    let currentGroup: MessageGroup | null = null;

    messages.forEach((message) => {
      if (!currentGroup || currentGroup.senderId !== message.senderId) {
        // Start new group
        currentGroup = {
          senderId: message.senderId,
          messages: [message],
          timestamp: new Date(message.createdAt),
        };
        groups.push(currentGroup);
      } else {
        // Add to current group if within 5 minutes
        const timeDiff = new Date(message.createdAt).getTime() - currentGroup.timestamp.getTime();
        if (timeDiff < 5 * 60 * 1000) {
          currentGroup.messages.push(message);
        } else {
          // Start new group if time difference is too large
          currentGroup = {
            senderId: message.senderId,
            messages: [message],
            timestamp: new Date(message.createdAt),
          };
          groups.push(currentGroup);
        }
      }
    });

    return groups;
  }, [messages]);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (!messageContainerRef.current) return;

    const container = messageContainerRef.current;
    const scrollOptions: ScrollToOptions = {
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    };

    container.scrollTo(scrollOptions);
  }, []);

  // Auto scroll on new messages
  useEffect(() => {
    if (messages.length > lastMessageCountRef.current && isAutoScrollingRef.current) {
      scrollToBottom();
    }
    lastMessageCountRef.current = messages.length;
  }, [messages.length, scrollToBottom]);

  // Track scroll position for auto-scroll
  useEffect(() => {
    const container = messageContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      isAutoScrollingRef.current = isNearBottom;
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Send message with optimistic update
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return;

    setIsSending(true);
    try {
      await sendChatMessage(content);
      scrollToBottom();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [sendChatMessage, isSending, scrollToBottom]);

  // Load more messages
  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loading) return;

    const nextPage = page + 1;
    await fetchMessages(conversationId, nextPage);
    setPage(nextPage);
  }, [conversationId, fetchMessages, hasMore, loading, page]);

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    markChatAsRead(messageId);
  }, [markChatAsRead]);

  // Delete message
  const deleteMessage = useCallback(async (messageId: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${API_URL}/chat/message/${messageId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete message');
      }

      // Message will be removed through socket events
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }, []);

  // Edit message
  const editMessage = useCallback(async (messageId: string, newContent: string) => {
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
      const response = await fetch(`${API_URL}/chat/message/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ content: newContent }),
      });

      if (!response.ok) {
        throw new Error('Failed to edit message');
      }

      // Message will be updated through socket events
    } catch (error) {
      console.error('Failed to edit message:', error);
      throw error;
    }
  }, []);

  // Retry failed message
  const retryMessage = useCallback(async (messageId: string) => {
    await retryChatMessage(messageId);
    scrollToBottom();
  }, [retryChatMessage, scrollToBottom]);

  return {
    groupedMessages,
    isLoading: loading,
    isSending,
    hasMore,
    sendMessage,
    retryMessage,
    loadMoreMessages,
    markAsRead,
    deleteMessage,
    editMessage,
    messageContainerRef,
    scrollToBottom,
  };
}