"use client";

import { FiHeart, FiShare2 } from 'react-icons/fi';
import LikeButton from '@/components/ui/LikeButton';
import { ReactNode } from 'react';

interface PostActionsProps {
  liked?: boolean;
  likeCount?: number;
  onLike?: () => void;
  onShare?: () => void;
  LikeButtonComponent?: ReactNode;
}

export default function PostActions({
  liked = false,
  likeCount = 0,
  onLike,
  onShare,
  LikeButtonComponent,
}: PostActionsProps) {
  return (
    <div className="flex items-center justify-between border-t border-b border-gray-100 py-4">
      <div className="flex items-center space-x-6">
        {LikeButtonComponent ? (
          LikeButtonComponent
        ) : (
          <button
            onClick={onLike}
            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-xs transition-colors ${
              liked 
                ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
            }`}
          >
            <FiHeart className={`w-4 h-4 ${liked ? 'fill-current' : ''}`} />
            <span>{likeCount}</span>
          </button>
        )}
        
        <button
          onClick={onShare}
          className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          <FiShare2 className="w-4 h-4" />
          <span>공유</span>
        </button>
      </div>
    </div>
  );
} 