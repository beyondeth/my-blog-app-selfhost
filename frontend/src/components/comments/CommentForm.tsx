'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { Avatar } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { FiSmile, FiLoader } from 'react-icons/fi';

interface CommentFormProps {
  postId: string;
  parentCommentId?: string;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  initialValue?: string;
  placeholder?: string;
  submitText?: string;
  maxLength?: number;
  autoFocus?: boolean;
}

// 자주 사용하는 이모티콘 목록
const COMMON_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊',
  '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
  '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪',
  '🤗', '🤔', '🤭', '🤫', '🤐', '😐', '😑', '😶',
  '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪',
  '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
  '🥵', '🥶', '😶‍🌫️', '🥴', '😵', '🤯', '🤠', '🥳',
  '😎', '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮',
  '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰',
  '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓',
  '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '👍',
  '👎', '👏', '🙌', '🤝', '🙏', '❤️', '💕', '💖',
  '💗', '💙', '💚', '💛', '🧡', '💜', '🖤', '🤍',
  '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '🕳️',
  '💬', '👁️‍🗨️', '🗨️', '🗯️', '💭', '💤', '🔥', '✨',
];

export default function CommentForm({
  postId,
  parentCommentId,
  onSubmit,
  onCancel,
  isLoading = false,
  initialValue = '',
  placeholder = '댓글 추가...',
  submitText = '댓글',
  maxLength = 1000,
  autoFocus = false
}: CommentFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // 수정 모드 또는 autoFocus인 경우 자동 포커스 및 높이 조정
  useEffect(() => {
    if (textareaRef.current) {
      if (initialValue || autoFocus) {
        setIsFocused(true);
        textareaRef.current.focus();
      }

      // 수정 모드일 때 초기 높이 설정 (전체 내용 표시)
      if (initialValue) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [initialValue, autoFocus]);

  // 이모지 피커 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (content.length > maxLength) {
      toast.error(`댓글은 최대 ${maxLength}자까지 입력할 수 있습니다.`);
      return;
    }

    onSubmit(content.trim());
    if (!parentCommentId && !initialValue) {
      setContent(''); // 새 댓글 작성 시에만 초기화
    }
    setIsFocused(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;

    if (newContent.length > maxLength) {
      toast.error(`댓글은 최대 ${maxLength}자까지 입력할 수 있습니다.`);
      return;
    }

    setContent(newContent);

    // 자동 높이 조절
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = textareaRef.current.scrollHeight;

      // 수정 모드일 때는 높이 제한 없음, 새 댓글일 때만 200px 제한
      if (initialValue) {
        // 수정 모드: 전체 내용 표시
        textareaRef.current.style.height = `${newHeight}px`;
        textareaRef.current.style.overflowY = 'hidden';
      } else {
        // 새 댓글: 200px 제한
        if (newHeight > 200) {
          textareaRef.current.style.height = '200px';
          textareaRef.current.style.overflowY = 'auto';
        } else {
          textareaRef.current.style.height = `${newHeight}px`;
          textareaRef.current.style.overflowY = 'hidden';
        }
      }
    }
  };

  const handleCancel = () => {
    setContent(initialValue);
    setIsFocused(false);
    setShowEmojiPicker(false);
    if (onCancel) {
      onCancel();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    const newContent = content + emoji;

    if (newContent.length > maxLength) {
      toast.error(`댓글은 최대 ${maxLength}자까지 입력할 수 있습니다.`);
      return;
    }

    setContent(newContent);
    setShowEmojiPicker(false);

    // 포커스 유지
    if (textareaRef.current) {
      textareaRef.current.focus();

      // 자동 높이 조절
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
      }, 0);
    }
  };

  if (!user) {
    return (
      <div className="bg-gray-50 border border-gray-200 dark:bg-[rgb(38,38,38)] dark:border-gray-700 rounded-lg p-4 text-center text-gray-600 dark:text-gray-400">
        <p>댓글을 작성하려면 <a href="/login" className="text-blue-600 hover:underline dark:text-blue-400 dark:hover:underline">로그인</a>해주세요.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex items-start gap-4">
        {/* 사용자 프로필 사진 - 수정 모드가 아닐 때만 표시 */}
        {!initialValue && (
          <Avatar
            src={user.profileImage}
            alt={user.username || '사용자'}
            fallback={user.username || '사용자'}
            size={isFocused ? "md" : "xs"}
            className="flex-shrink-0"
          />
        )}

        {/* 댓글 입력 영역 */}
        <div className={initialValue ? "flex-1" : "flex-1"}>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleChange}
              onFocus={() => setIsFocused(true)}
              placeholder={isLoading ? '작성 중입니다...' : placeholder}
              disabled={isLoading}
              rows={1}
              className={`w-full resize-none border-0 border-b-2 bg-transparent px-0 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none transition-all duration-200 ${
                isFocused
                  ? 'border-gray-900 dark:border-gray-100'
                  : 'border-gray-300 dark:border-gray-700'
              } ${
                isLoading ? 'opacity-60 cursor-not-allowed' : ''
              }`}
              style={{
                minHeight: '24px',
                maxHeight: initialValue ? 'none' : '200px',
                overflow: initialValue ? 'visible' : 'hidden',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE/Edge
              } as React.CSSProperties & { scrollbarWidth?: string; msOverflowStyle?: string }}
            />
          </div>

          {/* 버튼 영역 - 포커스 시에만 표시 */}
          {isFocused && (
            <div className="flex items-center justify-between mt-2">
              {/* 이모티콘 버튼 */}
              <div className="relative" ref={emojiPickerRef}>
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={isLoading}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="이모티콘 추가"
                >
                  {isLoading ? (
                    <FiLoader className="w-5 h-5 animate-spin" />
                  ) : (
                    <FiSmile className="w-5 h-5" />
                  )}
                </button>

                {/* 이모티콘 피커 */}
                {showEmojiPicker && (
                  <div className="absolute left-0 bottom-full mb-2 w-80 max-h-60 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-50">
                    <div className="grid grid-cols-8 gap-2">
                      {COMMON_EMOJIS.map((emoji, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleEmojiSelect(emoji)}
                          className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 rounded p-1 transition-colors"
                          title={emoji}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 취소/댓글 버튼 */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium rounded-full text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!content.trim() || isLoading}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700 flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <FiLoader className="w-4 h-4 animate-spin" />
                      작성 중...
                    </>
                  ) : (
                    submitText
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </form>
  );
}
