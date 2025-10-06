'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { Textarea } from '@/components/ui/textarea';

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
}

export default function CommentForm({
  postId,
  parentCommentId,
  onSubmit,
  onCancel,
  isLoading = false,
  initialValue = '',
  placeholder = '댓글을 작성해주세요...',
  submitText = '댓글 작성',
  maxLength = 1000
}: CommentFormProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    onSubmit(content.trim());
    if (!parentCommentId && !initialValue) {
      setContent(''); // 새 댓글 작성 시에만 초기화
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="relative">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxLength))}
            placeholder={placeholder}
            rows={4}
            disabled={isLoading}
            className="resize-none pr-16"
            maxLength={maxLength}
          />
          <div className={`absolute bottom-2 right-2 text-xs ${
            content.length > maxLength * 0.9
              ? 'text-red-500'
              : 'text-gray-400 dark:text-gray-600'
          }`}>
            {content.length}/{maxLength}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-[13px] font-medium rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 dark:!bg-gray-700 dark:!text-gray-100 dark:hover:!bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            취소
          </button>
        )}
        <button
          type="submit"
          disabled={!content.trim() || isLoading}
          className="px-4 py-2 text-[13px] font-medium rounded-full bg-gray-100 text-gray-900 hover:bg-gray-200 dark:!bg-gray-700 dark:!text-gray-100 dark:hover:!bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? '작성 중...' : submitText}
        </button>
      </div>
    </form>
  );
}