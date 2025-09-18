"use client";

import { queryKeys } from '@/lib/query-keys';
import { FollowInfo } from '@/types/api';
import { Users, UserCheck } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import useFollowInfo from '@/hooks/useFollowInfo';

interface FollowStatsProps {
  userId: string;
  className?: string;
  showIcons?: boolean;
  initialState?: FollowInfo;
}

export default function FollowStats({ 
  userId, 
  className = '',
  showIcons = true,
  initialState
}: FollowStatsProps) {
  const { followInfo, isLoading } = useFollowInfo(userId, initialState);

  if (isLoading && !initialState) {
    return (
      <div className={`flex gap-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-6 text-sm ${className}`}>
      <div className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 transition-colors duration-200">
        {showIcons && <Users className="w-4 h-4" />}
        <span className="font-medium">
          {followInfo.followersCount.toLocaleString()}
        </span>
        <span>팔로워</span>
      </div>
      
      <div className="flex items-center gap-1.5 text-gray-600 hover:text-gray-800 transition-colors duration-200">
        {showIcons && <UserCheck className="w-4 h-4" />}
        <span className="font-medium">
          {followInfo.followingCount.toLocaleString()}
        </span>
        <span>팔로잉</span>
      </div>
    </div>
  );
}