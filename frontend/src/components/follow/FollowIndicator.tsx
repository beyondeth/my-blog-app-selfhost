"use client";

import { FollowInfo } from '@/types/api';
import { UserCheck } from 'lucide-react';
import useFollowInfo from '@/hooks/useFollowInfo';
import { useAuth } from '@/providers/AuthProviderV2';

interface FollowIndicatorProps {
  userId: string;
  className?: string;
  initialState?: FollowInfo;
}

/**
 * 팔로우 상태를 나타내는 작은 인디케이터
 * 사용자 이름 옆에 "팔로잉 중" 표시용
 */
export default function FollowIndicator({ 
  userId, 
  className = '',
  initialState
}: FollowIndicatorProps) {
  const { user } = useAuth();
  const { followInfo } = useFollowInfo(userId, initialState);

  // 로그인하지 않았거나 자신의 프로필이면 표시하지 않음
  if (!user || user.id === userId || !followInfo?.isFollowedByUser) {
    return null;
  }

  return (
    <div className={`inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200 ${className}`}>
      <UserCheck className="w-3 h-3" />
      <span className="font-medium">팔로잉 중</span>
    </div>
  );
}