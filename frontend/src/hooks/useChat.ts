import { useState, useEffect, useCallback } from 'react';
import { useSocket } from './useSocket';
import { useAuth } from '@/providers/AuthProviderV2';
import toast from 'react-hot-toast';

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  readAt?: Date;
  isEdited: boolean;
  editedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  sender?: {
    id: string;
    username: string;
    profileImage?: string;
  };
}

export interface Conversation {
  id: string;
  user1Id: string;
  user2Id: string;
  lastMessageAt?: Date;
  user1?: {
    id: string;
    username: string;
    profileImage?: string;
  };
  user2?: {
    id: string;
    username: string;
    profileImage?: string;
  };
}

export function useChat(conversationId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const socket = useSocket();
  const { user } = useAuth();
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/chat/conversations`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  }, [API_URL]);

  // Fetch conversation by ID
  const fetchConversationById = useCallback(async (convId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/chat/conversations`, {
        credentials: 'include'
      });

      if (response.ok) {
        const conversations = await response.json();
        const conversation = conversations.find((c: Conversation) => c.id === convId);
        if (conversation) {
          setCurrentConversation(conversation);
          return conversation;
        }
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Fetch or create conversation
  const getOrCreateConversation = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/chat/conversation/${userId}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const conversation = await response.json();
        setCurrentConversation(conversation);
        return conversation;
      } else {
        console.error('Failed to get conversation:', response.status);
        if (response.status === 403 || response.status === 401) {
          toast.error('Please login to send messages');
        } else {
          toast.error('Failed to start conversation');
        }
        return null;
      }
    } catch (error) {
      console.error('Error getting conversation:', error);
      toast.error('Failed to start conversation');
      return null;
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Fetch messages
  const fetchMessages = useCallback(async (convId: string, page = 1) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/chat/messages/${convId}?page=${page}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (page === 1) {
          setMessages(data.messages);
        } else {
          setMessages(prev => [...data.messages, ...prev]);
        }
        setHasMore(data.hasMore);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  }, [API_URL]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!conversationId || !socket) return;

    try {
      // Create optimistic message first
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        senderId: user?.id || '',
        content,
        isRead: false,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        sender: user ? {
          id: user.id,
          username: user.username,
          profileImage: user.profileImage
        } : undefined
      };

      // Add optimistic message immediately
      setMessages(prev => [...prev, optimisticMessage]);

      const response = await fetch(`${API_URL}/chat/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          conversationId,
          content
        })
      });

      if (!response.ok) {
        // Remove optimistic message on failure
        setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
        throw new Error('Failed to send message');
      }

      const message = await response.json();

      // Replace optimistic message with real message
      // Only update if the message content or important fields changed
      setMessages(prev => prev.map(msg => {
        if (msg.id === optimisticMessage.id) {
          // Preserve the UI state while updating the actual data
          return {
            ...message,
            // Keep the same created date to avoid re-rendering
            createdAt: optimisticMessage.createdAt,
          };
        }
        return msg;
      }));

      // Note: No need to emit through socket here
      // The backend will handle broadcasting the message through WebSocket
      // after it's saved to the database via the HTTP POST request

      return message;
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  }, [conversationId, socket, API_URL, user]);

  // Mark message as read
  const markAsRead = useCallback(async (messageId: string) => {
    try {
      await fetch(`${API_URL}/chat/message/${messageId}/read`, {
        method: 'POST',
        credentials: 'include'
      });

      if (socket) {
        socket.emit('mark-read', messageId);
      }
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  }, [socket, API_URL]);

  // Handle typing
  const handleTyping = useCallback((typing: boolean) => {
    if (!socket || !conversationId) return;

    socket.emit('typing', {
      conversationId,
      isTyping: typing
    });
  }, [socket, conversationId]);

  // Block user
  const blockUser = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/block/${userId}`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('User blocked');
        await fetchConversations();
      }
    } catch (error) {
      console.error('Error blocking user:', error);
      toast.error('Failed to block user');
    }
  }, [API_URL, fetchConversations]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Join conversation room
    if (conversationId) {
      socket.emit('join-conversation', conversationId);
    }

    // Listen for new messages
    socket.on('new-message', (message: Message) => {
      if (message.conversationId === conversationId) {
        // Skip if this is our own message (we already have it from optimistic update)
        if (message.senderId === user?.id) {
          // Just update the message with server data if needed
          setMessages(prev => prev.map(msg => {
            // Find temp message by content and time proximity
            if (msg.id.startsWith('temp-') &&
                msg.content === message.content &&
                msg.senderId === message.senderId) {
              return message;
            }
            // Or if it's already the same message
            if (msg.id === message.id) {
              return message;
            }
            return msg;
          }));
          return;
        }

        // For messages from other users, add them
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === message.id);
          if (exists) return prev;
          return [...prev, message];
        });

        // Mark as read if it's from other user
        markAsRead(message.id);
      }
    });

    // Listen for typing events
    socket.on('user-typing', (data: { userId: string; isTyping: boolean }) => {
      if (data.userId !== user?.id) {
        setTypingUser(data.isTyping ? data.userId : null);
      }
    });

    // Listen for read receipts
    socket.on('message-read', (data: { messageId: string; userId: string }) => {
      setMessages(prev => prev.map(msg =>
        msg.id === data.messageId
          ? { ...msg, isRead: true, readAt: new Date() }
          : msg
      ));
    });

    return () => {
      if (conversationId) {
        socket.emit('leave-conversation', conversationId);
      }
      socket.off('new-message');
      socket.off('user-typing');
      socket.off('message-read');
    };
  }, [socket, conversationId, user?.id, markAsRead]);

  // Fetch initial data
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (conversationId) {
      // Clear messages first to prevent duplication
      setMessages([]);
      fetchMessages(conversationId);
      fetchConversationById(conversationId);
    }
  }, [conversationId, fetchMessages, fetchConversationById]);

  return {
    messages,
    conversations,
    currentConversation,
    loading,
    hasMore,
    typingUser,
    sendMessage,
    markAsRead,
    handleTyping,
    blockUser,
    fetchMessages,
    getOrCreateConversation,
    fetchConversations
  };
}