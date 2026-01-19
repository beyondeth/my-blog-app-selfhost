'use client';

/**
 * Reddit 스타일 투표 버튼 컴포넌트
 *
 * @description
 * - Upvote/Downvote 기능을 제공하는 컴포넌트
 * - 수직 레이아웃 (▲ 점수 ▼) 또는 수평 레이아웃 지원
 * - 현재 투표 상태에 따른 시각적 피드백
 */

import { memo, useCallback } from 'react';
import { FiThumbsUp, FiThumbsDown } from 'react-icons/fi';
import type { VoteType } from '@/types';

interface VoteButtonProps {
  /** 업보트 수 */
  upvoteCount: number;
  /** 다운보트 수 */
  downvoteCount: number;
  /** 현재 사용자의 투표 상태 */
  userVote: VoteType;
  /** 투표 핸들러 */
  onVote: (voteType: 'upvote' | 'downvote') => void;
  /** 비활성화 여부 */
  disabled?: boolean;
  /** 레이아웃 방향 */
  layout?: 'vertical' | 'horizontal';
  /** 컴팩트 모드 (작은 크기) */
  compact?: boolean;
  /** 점수 표시 여부 */
  showScore?: boolean;
  /** 분리 표시 모드 (▲12 ▼3) vs 점수 모드 (9) */
  displayMode?: 'separated' | 'score';
  /** 추가 CSS 클래스 */
  className?: string;
  /** 색상 톤 */
  tone?: 'default' | 'harbor';
}

/**
 * 점수 포맷팅 (1000 → 1K)
 */
function formatCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return String(count);
}

/**
 * VoteButton 컴포넌트
 */
export const VoteButton = memo(function VoteButton({
  upvoteCount,
  downvoteCount,
  userVote,
  onVote,
  disabled = false,
  layout = 'horizontal',
  compact = false,
  showScore = true,
  displayMode = 'separated',
  className = '',
  tone = 'default',
}: VoteButtonProps) {
  const score = upvoteCount - downvoteCount;

  const handleUpvote = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        onVote('upvote');
      }
    },
    [disabled, onVote]
  );

  const handleDownvote = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) {
        onVote('downvote');
      }
    },
    [disabled, onVote]
  );

  // 스타일 클래스
  const iconSize = compact ? 'w-4 h-4' : 'w-5 h-5';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const labelSize = compact ? 'text-[11px]' : 'text-sm';
  const baseButtonClass = `
    inline-flex items-center gap-1 ${compact ? 'px-1 py-0.5' : 'px-1.5 py-0.5'}
    text-xs font-medium transition-colors duration-150
    focus-visible:outline-none focus-visible:ring-0
    ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
  `;

  const toneClasses =
    tone === 'harbor'
      ? {
          active: 'text-[#1B2430] dark:text-[#E6EDF3]',
          inactive: 'text-[#425466] dark:text-[#C7D2E0] hover:text-[#1B2430] dark:hover:text-[#E6EDF3]',
          score: 'text-[#4B5563] dark:text-[#A9B4C2]',
          downScore: 'text-[#7B8794] dark:text-[#A9B4C2]',
        }
      : {
          active: 'text-gray-900 dark:text-gray-100',
          inactive: 'text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100',
          score: 'text-gray-700 dark:text-gray-200',
          downScore: 'text-gray-600 dark:text-gray-300',
        };

  const activeVoteClass = toneClasses.active;
  const inactiveVoteClass = toneClasses.inactive;

  const upvoteButtonClass = `
    ${baseButtonClass}
    ${userVote === 'upvote' ? activeVoteClass : inactiveVoteClass}
  `;

  const downvoteButtonClass = `
    ${baseButtonClass}
    ${userVote === 'downvote' ? activeVoteClass : inactiveVoteClass}
  `;

  // 점수 색상
  const scoreColorClass = toneClasses.score;

  // 수직 레이아웃 (Reddit 스타일)
  if (layout === 'vertical') {
    return (
      <div
        className={`flex flex-col items-center gap-0.5 ${className}`}
        role="group"
        aria-label="투표"
      >
        {/* Upvote 버튼 */}
        <button
          type="button"
          onClick={handleUpvote}
        className={upvoteButtonClass}
        disabled={disabled}
        aria-label={userVote === 'upvote' ? '좋아요 취소' : '좋아요'}
        aria-pressed={userVote === 'upvote'}
      >
        <FiThumbsUp className={iconSize} />
        {!compact && <span className={labelSize}>{userVote === 'upvote' ? '좋아요!' : '좋아요'}</span>}
      </button>

        {/* 점수 표시 */}
        {showScore && (
          <span className={`${textSize} font-semibold tabular-nums ${scoreColorClass}`}>
            {displayMode === 'score' ? formatCount(score) : formatCount(upvoteCount)}
          </span>
        )}

        {/* Downvote 버튼 */}
        <button
          type="button"
          onClick={handleDownvote}
          className={downvoteButtonClass}
          disabled={disabled}
          aria-label={userVote === 'downvote' ? '안 좋아요 취소' : '안 좋아요'}
          aria-pressed={userVote === 'downvote'}
        >
          <FiThumbsDown className={iconSize} />
          {!compact && <span className={labelSize}>{userVote === 'downvote' ? '안 좋아요' : '안 좋아요'}</span>}
        </button>

        {/* 분리 표시 모드에서 다운보트 수 */}
        {displayMode === 'separated' && showScore && (
          <span className={`${textSize} ${toneClasses.downScore} tabular-nums`}>
            {formatCount(downvoteCount)}
          </span>
        )}
      </div>
    );
  }

  // 수평 레이아웃 (기본)
  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
      role="group"
      aria-label="투표"
    >
      {/* Upvote 버튼 */}
      <button
        type="button"
        onClick={handleUpvote}
        className={`${upvoteButtonClass} flex items-center gap-1`}
        disabled={disabled}
        aria-label={userVote === 'upvote' ? '좋아요 취소' : '좋아요'}
        aria-pressed={userVote === 'upvote'}
      >
        <FiThumbsUp className={iconSize} />
        {!compact && <span className={labelSize}>{userVote === 'upvote' ? '좋아요!' : '좋아요'}</span>}
        {showScore && displayMode === 'separated' && (
          <span className={`${textSize} font-medium tabular-nums`}>
            {formatCount(upvoteCount)}
          </span>
        )}
      </button>

      {/* 점수 모드에서 중앙 점수 표시 */}
      {showScore && displayMode === 'score' && (
        <span className={`${textSize} font-semibold tabular-nums min-w-[2ch] text-center ${scoreColorClass}`}>
          {formatCount(score)}
        </span>
      )}

      {/* Downvote 버튼 */}
      <button
        type="button"
        onClick={handleDownvote}
        className={`${downvoteButtonClass} flex items-center gap-1`}
        disabled={disabled}
        aria-label={userVote === 'downvote' ? '안 좋아요 취소' : '안 좋아요'}
        aria-pressed={userVote === 'downvote'}
      >
        <FiThumbsDown className={iconSize} />
        {!compact && <span className={labelSize}>안 좋아요</span>}
        {showScore && displayMode === 'separated' && (
          <span className={`${textSize} font-medium tabular-nums`}>
            {formatCount(downvoteCount)}
          </span>
        )}
      </button>
    </div>
  );
});

export default VoteButton;
