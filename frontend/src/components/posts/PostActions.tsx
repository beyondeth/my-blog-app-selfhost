"use client";

import { FiShare2 } from 'react-icons/fi';
import VoteButton from '@/components/ui/VoteButton';
import type { VoteType } from '@/types';

interface PostActionsProps {
  /** 업보트 수 */
  upvoteCount: number;
  /** 다운보트 수 */
  downvoteCount: number;
  /** 현재 사용자의 투표 상태 */
  userVote: VoteType;
  /** 투표 핸들러 */
  onVote: (voteType: 'upvote' | 'downvote') => void;
  /** 투표 로딩 상태 */
  isVotePending?: boolean;
  /** 공유 핸들러 */
  onShare?: () => void;
}

export default function PostActions({
  upvoteCount,
  downvoteCount,
  userVote,
  onVote,
  isVotePending = false,
  onShare,
}: PostActionsProps) {
  return (
    <div className="flex items-center justify-between border-t border-b border-gray-400 dark:border-gray-500 py-4">
      <div className="flex items-center space-x-6">
        <VoteButton
          upvoteCount={upvoteCount}
          downvoteCount={downvoteCount}
          userVote={userVote}
          onVote={onVote}
          disabled={isVotePending}
        />

        <button
          onClick={onShare}
          className="flex items-center space-x-2 px-3 py-1 rounded-full text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
        >
          <FiShare2 className="w-4 h-4" />
          <span>공유</span>
        </button>
      </div>
    </div>
  );
} 
