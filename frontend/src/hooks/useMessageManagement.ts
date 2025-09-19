import { useCallback, useRef, useMemo, useEffect } from 'react';
import { useChatWithQuery } from './chat/useChatWithQuery';
import { Message } from '@/types/chat';

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
  retryMessage: (messageId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  markAsRead: (messageId: string) => void;
  deleteMessage: (messageId: string) => Promise<void>;
  editMessage: (messageId: string, newContent: string) => Promise<void>;
  messageContainerRef: React.RefObject<HTMLDivElement>;
  scrollToBottom: (smooth?: boolean) => void;
}

export function useMessageManagement(conversationId: string): UseMessageManagementReturn {
  // Use React Query based hook
  const {
    messages,
    hasMoreMessages,
    isLoadingMessages,
    isFetchingNextPage,
    sendMessage: sendMsg,
    retryMessage: retryMsg,
    markAsRead: markRead,
    loadMoreMessages: loadMore,
  } = useChatWithQuery(conversationId);

  const messageContainerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const prevScrollHeightRef = useRef(0);

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

  // Initial scroll to bottom when messages are first loaded
  useEffect(() => {
    if (messages.length > 0 && lastMessageCountRef.current === 0) {
      // First load - scroll to bottom instantly
      scrollToBottom(false);
    } else if (messages.length > lastMessageCountRef.current && isAutoScrollingRef.current) {
      // New messages - smooth scroll
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

  // Send message wrapper
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    await sendMsg(content);
    scrollToBottom();
  }, [sendMsg, scrollToBottom]);

  // Load more messages with scroll position preservation
  const loadMoreMessages = useCallback(async () => {
    if (!messageContainerRef.current || isFetchingNextPage) return;

    // Save current scroll position
    const container = messageContainerRef.current;
    prevScrollHeightRef.current = container.scrollHeight;
    const prevScrollTop = container.scrollTop;

    // Load more messages
    await loadMore();

    // Restore scroll position after messages are loaded
    requestAnimationFrame(() => {
      if (!messageContainerRef.current) return;
      const newScrollHeight = messageContainerRef.current.scrollHeight;
      const scrollDiff = newScrollHeight - prevScrollHeightRef.current;
      messageContainerRef.current.scrollTop = prevScrollTop + scrollDiff;
    });
  }, [loadMore, isFetchingNextPage]);

  // Mark message as read
  const markAsRead = useCallback((messageId: string) => {
    markRead(messageId);
  }, [markRead]);

  // Delete message (placeholder - needs backend implementation)
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
    } catch (error) {
      console.error('Failed to delete message:', error);
      throw error;
    }
  }, []);

  // Edit message (placeholder - needs backend implementation)
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
    } catch (error) {
      console.error('Failed to edit message:', error);
      throw error;
    }
  }, []);

  // Retry failed message
  const retryMessage = useCallback(async (messageId: string) => {
    await retryMsg(messageId);
    scrollToBottom();
  }, [retryMsg, scrollToBottom]);

  return {
    groupedMessages,
    isLoading: isLoadingMessages || isFetchingNextPage,
    isSending: false, // React Query handles this internally
    hasMore: hasMoreMessages,
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