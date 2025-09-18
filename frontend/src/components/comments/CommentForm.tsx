'use client';

import { useState } from 'react';
import { useAuth } from '@/providers/AuthProviderV2';
import { Button } from '@/components/ui/button';
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
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-600">
        <p>댓글을 작성하려면 <a href="/login" className="text-blue-600 hover:underline">로그인</a>해주세요.</p>
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
              : 'text-gray-400'
          }`}>
            {content.length}/{maxLength}
          </div>
        </div>
      </div>
      
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
          >
            취소
          </Button>
        )}
        <Button
          type="submit"
          disabled={!content.trim() || isLoading}
        >
          {isLoading ? '작성 중...' : submitText}
        </Button>
      </div>
    </form>
  );
}