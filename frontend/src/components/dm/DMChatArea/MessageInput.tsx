'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Send, Smile } from 'lucide-react';
import { useChat } from '@/hooks/useChat';

interface MessageInputProps {
  onSendMessage: (content: string) => Promise<void>;
  isSending: boolean;
  disabled?: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isSending,
  disabled = false,
}) => {
  const { handleTyping } = useChat();
  const [messageContent, setMessageContent] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessageContent(value);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set typing state
    if (value && !isTyping) {
      setIsTyping(true);
      handleTyping(true);
    }

    // Clear typing after 2 seconds of inactivity
    if (value) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        handleTyping(false);
      }, 2000);
    } else {
      setIsTyping(false);
      handleTyping(false);
    }
  }, [isTyping, handleTyping]);

  // Handle send message
  const handleSend = useCallback(async () => {
    if (!messageContent.trim() || isSending || disabled) return;

    const content = messageContent.trim();
    setMessageContent('');
    setIsTyping(false);
    handleTyping(false);

    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    await onSendMessage(content);

    // Focus input after sending
    inputRef.current?.focus();
  }, [messageContent, isSending, disabled, onSendMessage, handleTyping]);

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Auto-resize textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120); // Max 5 lines
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [messageContent, adjustTextareaHeight]);

  // Handle emoji selection
  const handleEmojiSelect = useCallback((emoji: string) => {
    setMessageContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTyping) {
        handleTyping(false);
      }
    };
  }, [isTyping, handleTyping]);

  return (
    <div className="
      px-4
      py-3
      bg-white
      border-t
      border-gray-200
    ">
      <div className="flex items-center gap-2">
        {/* Message input */}
        <div className="
          flex-1
          relative
          bg-gray-50
          rounded-2xl
          border
          border-gray-200
          focus-within:border-blue-400
          focus-within:bg-white
          transition-all
        ">
          <textarea
            ref={inputRef}
            value={messageContent}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={disabled ? 'You cannot send messages right now' : 'Type a message...'}
            disabled={disabled || isSending}
            className="
              w-full
              px-4
              py-3
              bg-transparent
              resize-none
              outline-none
              text-sm
              text-gray-700
              placeholder-gray-400
              max-h-32
              scrollbar-thin
              leading-normal
            "
            rows={1}
            style={{
              scrollbarWidth: 'thin',
              lineHeight: '1.25rem'
            }}
          />

          {/* Character count */}
          {messageContent.length > 800 && (
            <div className="
              absolute
              bottom-2
              right-2
              text-xs
              text-gray-500
            ">
              {messageContent.length}/1000
            </div>
          )}
        </div>

        {/* Emoji button */}
        <div className="relative">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="
              p-2
              rounded-lg
              hover:bg-gray-100
              transition-colors
              flex-shrink-0
            "
            aria-label="Add emoji"
          >
            <Smile className="w-5 h-5 text-gray-400" />
          </button>

          {/* Emoji picker popup */}
          {showEmojiPicker && (
            <div className="
              absolute
              bottom-12
              right-0
              bg-white
              rounded-lg
              shadow-lg
              border
              border-gray-200
              p-3
              z-50
              w-full max-w-[280px] sm:w-80
            ">
              <div className="grid grid-cols-8 gap-1">
                {['😀', '😁', '😂', '😃', '😄', '😅', '😆', '😇',
                  '😉', '😊', '😍', '😎', '😒', '😔', '😖', '😘',
                  '😚', '😜', '😝', '😞', '😠', '😡', '😢', '😭',
                  '👍', '👎', '👏', '🙏', '❤️', '💔', '🔥', '✨'].map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiSelect(emoji)}
                    className="
                      w-9
                      h-9
                      flex
                      items-center
                      justify-center
                      hover:bg-gray-100
                      rounded
                      text-xl
                      transition-colors
                    "
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!messageContent.trim() || isSending || disabled}
          className={`
            p-2
            rounded-lg
            transition-all
            duration-200
            flex-shrink-0
            ${messageContent.trim() && !isSending && !disabled
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }
          `}
          aria-label="Send message"
        >
          {isSending ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Hint text */}
      <p className="text-xs text-gray-400 mt-2 text-center">
        Press Enter to send, Shift+Enter for a new line
      </p>
    </div>
  );
};

export default MessageInput;
