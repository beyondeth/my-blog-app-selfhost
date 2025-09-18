'use client';

import { useState, useEffect, useRef } from 'react';
import { useChat } from '@/hooks/useChat';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, MoreVertical, Check, CheckCheck, Clock } from 'lucide-react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { Avatar } from '@/components/ui/avatar';

interface DMChatProps {
  conversationId: string;
}

export function DMChat({ conversationId }: DMChatProps) {
  const { messages, currentConversation, loading, sendMessage, handleTyping, typingUser } = useChat(conversationId);
  const { user } = useAuth();
  const router = useRouter();
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Format message timestamp with better UX
  const formatMessageTime = (date: Date) => {
    if (isToday(date)) {
      return format(date, 'HH:mm');
    } else if (isYesterday(date)) {
      return `Yesterday ${format(date, 'HH:mm')}`;
    } else {
      return format(date, 'MMM d, HH:mm');
    }
  };

  // Get message status icon
  const getMessageStatusIcon = (message: any, isOwnMessage: boolean) => {
    if (!isOwnMessage) return null;

    if (message.id?.startsWith('temp-')) {
      return <Clock className="w-3 h-3 text-gray-400" />;
    } else if (message.isRead) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    } else {
      return <Check className="w-3 h-3 text-gray-400" />;
    }
  };

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    // Smooth scroll with better animation
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageContent.trim() || isSending) return;

    const content = messageContent.trim();
    setMessageContent('');
    setIsSending(true);

    try {
      await sendMessage(content);
      // Focus input after sending
      inputRef.current?.focus();
    } finally {
      setIsSending(false);
    }
  };

  if (loading && !messages.length) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-blue-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
          </div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 mb-1">Loading conversation</p>
            <p className="text-sm text-gray-500">Please wait a moment...</p>
          </div>
        </div>
      </div>
    );
  }

  const otherUser = currentConversation?.user1Id === user?.id
    ? currentConversation?.user2
    : currentConversation?.user1;

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Container wrapper for desktop */}
      <div className="max-w-4xl mx-auto w-full flex flex-col h-full bg-white/80 backdrop-blur-sm shadow-2xl border border-white/20">
        {/* Header */}
        <div className="bg-white/90 backdrop-blur-md border-b border-gray-200/50 px-4 sm:px-6 py-4 flex items-center gap-4 shadow-sm">
          <button
            onClick={() => router.push('/dm')}
            className="p-2.5 hover:bg-blue-50 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="Back to messages"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-4 flex-1">
            <div className="relative">
              <Avatar
                src={otherUser?.profileImage}
                fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
                size="md"
                className="ring-2 ring-white shadow-md"
              />
              {/* Online status indicator */}
              <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-gray-900 truncate text-lg">
                {otherUser?.username || 'Loading...'}
              </h2>
              {typingUser ? (
                <div className="flex items-center gap-1">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-blue-600 font-medium ml-2">typing...</span>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Active now</p>
              )}
            </div>
          </div>

          <button
            className="p-2.5 hover:bg-gray-50 rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            aria-label="More options"
          >
            <MoreVertical className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-6 space-y-4 bg-gradient-to-b from-blue-50/30 via-white/50 to-slate-50/30 backdrop-blur-sm"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23f1f5f9' fill-opacity='0.1'%3E%3Ccircle cx='7' cy='7' r='1'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }}
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-6">
                <Send className="w-10 h-10 text-blue-500" />
              </div>
              <p className="text-xl font-semibold mb-2 text-gray-700">Start your conversation</p>
              <p className="text-sm text-gray-500 text-center max-w-sm">Send a message to {otherUser?.username} to begin chatting</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwnMessage = message.senderId === user?.id;
              const prevMessage = messages[index - 1];
              const showAvatar = !isOwnMessage && (index === 0 || prevMessage?.senderId !== message.senderId);
              const isFirstInGroup = index === 0 || prevMessage?.senderId !== message.senderId;
              const isLastInGroup = index === messages.length - 1 || messages[index + 1]?.senderId !== message.senderId;

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'} group animate-slide-in-bottom`}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className={`flex items-end gap-3 max-w-[85%] sm:max-w-[70%]`}>
                    {!isOwnMessage ? (
                      showAvatar ? (
                        <Avatar
                          src={otherUser?.profileImage}
                          fallback={otherUser?.username?.[0]?.toUpperCase() || '?'}
                          size="sm"
                          className="mb-1 ring-2 ring-white shadow-sm"
                        />
                      ) : (
                        <div className="w-8 h-8 mb-1" />
                      )
                    ) : null}

                    <div className="flex flex-col space-y-1">
                      <div
                        className={`relative px-4 py-3 break-words transition-all duration-200 hover:scale-[1.02] ${
                          isOwnMessage
                            ? `bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg ${
                                isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-lg'
                              } ${
                                isLastInGroup ? 'rounded-bl-2xl rounded-br-lg' : 'rounded-bl-lg rounded-br-lg'
                              }`
                            : `bg-white text-gray-800 border border-gray-100 shadow-md hover:shadow-lg ${
                                isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-lg'
                              } ${
                                isLastInGroup ? 'rounded-br-2xl rounded-bl-lg' : 'rounded-br-lg rounded-bl-lg'
                              }`
                        }`}
                      >
                        <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{message.content}</p>

                        {/* Message status and time */}
                        <div className={`flex items-center gap-1 mt-2 ${
                          isOwnMessage ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className={`text-xs ${
                            isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                          }`}>
                            {formatMessageTime(new Date(message.createdAt))}
                          </span>
                          {getMessageStatusIcon(message, isOwnMessage)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Area */}
        <form
          onSubmit={handleSendMessage}
          className="bg-white/90 backdrop-blur-md border-t border-gray-200/50 p-4 shadow-lg"
        >
          <div className="flex gap-3 items-end max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={messageContent}
                onChange={(e) => {
                  setMessageContent(e.target.value);
                  handleTyping(true);
                }}
                onFocus={() => {
                  setInputFocused(true);
                  handleTyping(true);
                }}
                onBlur={() => {
                  setInputFocused(false);
                  handleTyping(false);
                }}
                placeholder="Type a message..."
                className={`w-full px-4 py-3 bg-gray-50 rounded-2xl border-2 transition-all duration-200 text-sm sm:text-base resize-none overflow-hidden ${
                  inputFocused || messageContent
                    ? 'border-blue-300 bg-white shadow-md focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
                    : 'border-gray-200 hover:border-gray-300 focus:border-blue-300 focus:bg-white'
                } focus:outline-none`}
                disabled={isSending}
                maxLength={1000}
                autoFocus
              />

              {/* Character count */}
              {messageContent.length > 800 && (
                <div className="absolute -top-6 right-2 text-xs text-gray-500">
                  {messageContent.length}/1000
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={!messageContent.trim() || isSending}
              className={`p-3 rounded-2xl transition-all duration-200 transform active:scale-95 disabled:cursor-not-allowed ${
                messageContent.trim() && !isSending
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg hover:shadow-xl hover:scale-105 disabled:opacity-50'
                  : 'bg-gray-200 text-gray-400 disabled:opacity-50'
              }`}
              aria-label="Send message"
            >
              {isSending ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

