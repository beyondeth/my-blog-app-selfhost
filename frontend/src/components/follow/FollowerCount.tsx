'use client';

import Link from 'next/link';
import { FollowInfo } from '@/types/api';
import useFollowInfo from '@/hooks/useFollowInfo';

interface FollowerCountProps {
  userId: string;
  username?: string;
  className?: string;
  initialState?: FollowInfo;
  showLinks?: boolean;
}

export default function FollowerCount({ 
  userId, 
  username, 
  className = '', 
  initialState,
  showLinks = true 
}: FollowerCountProps) {
  const { followInfo, isLoading } = useFollowInfo(userId, initialState);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  if (isLoading && !initialState) {
    return (
      <div className={`flex items-center gap-4 text-sm ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </div>
      </div>
    );
  }

  const FollowerSection = ({ count, label, linkPath }: { count: number; label: string; linkPath?: string }) => {
    const content = (
      <>
        <span className="font-semibold text-gray-900">
          {formatNumber(count)}
        </span>
        <span className="text-gray-500 ml-1">{label}</span>
      </>
    );

    if (showLinks && username && linkPath) {
      return (
        <Link
          href={linkPath}
          className="hover:underline hover:text-blue-600 transition-colors duration-200"
        >
          {content}
        </Link>
      );
    }

    return <div>{content}</div>;
  };

  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      <FollowerSection 
        count={followInfo.followersCount}
        label="팔로워"
        // TODO: 팔로워 전체보기 페이지 구현 예정
        // linkPath={username ? `/users/${username}/followers` : undefined}
      />
      <FollowerSection 
        count={followInfo.followingCount}
        label="팔로잉"
        // TODO: 팔로잉 전체보기 페이지 구현 예정  
        // linkPath={username ? `/users/${username}/following` : undefined}
      />
    </div>
  );
}