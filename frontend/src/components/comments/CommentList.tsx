'use client';

import type { Comment } from '@/types';
import CommentItem from './CommentItem';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

interface CommentListProps {
  comments: Comment[];
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onReply: (content: string, parentId: string) => void;
  isLoading?: boolean;
  postAuthorId?: string;
  sortType?: 'popular' | 'latest';
}

export default function CommentList({
  comments,
  onUpdate,
  onDelete,
  onReply,
  isLoading = false,
  postAuthorId,
  sortType = 'latest'
}: CommentListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!comments || comments.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>아직 댓글이 없습니다.</p>
        <p className="text-sm mt-1">첫 번째 댓글을 작성해보세요!</p>
      </div>
    );
  }

  return (
    <div>
      {comments
        .filter(comment => !comment.isDeleted) // 삭제된 최상위 댓글 제외
        .map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onReply={onReply}
            isLoading={isLoading}
            postAuthorId={postAuthorId}
            level={0}
          />
        ))}
    </div>
  );
}