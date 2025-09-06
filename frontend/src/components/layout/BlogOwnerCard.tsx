"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import UserAvatar from '@/components/ui/UserAvatar';
import FollowButton from '@/components/FollowButton';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';

interface BlogOwnerCardProps {
  name?: string;
  username?: string;
  description?: string;
  profileImage?: string | null;
  userId?: string;
  isOwner?: boolean;
}

interface FollowInfo {
  followersCount: number;
  followingCount: number;
  isFollowedByUser: boolean;
}

const BlogOwnerCard = React.memo(function BlogOwnerCard({ 
  name = "개발자",
  username,
  description,
  profileImage,
  userId,
  isOwner = false
}: BlogOwnerCardProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  // 팔로우 정보 조회
  const { data: followInfo, isLoading: isLoadingFollowInfo } = useQuery<FollowInfo>({
    queryKey: queryKeys.users.followInfo(userId!),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow-info`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch follow info: ${response.status}`);
      }
      
      return response.json();
    },
    enabled: !!userId,
    staleTime: 30000, // 30초간 캐시 유지
  });

  // 팔로워 수 포맷팅 (예: 17.4K)
  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      const formatted = (count / 1000).toFixed(1);
      // .0을 제거 (17.0K -> 17K)
      return formatted.endsWith('.0') ? `${Math.floor(count / 1000)}K` : `${formatted}K`;
    }
    return count.toString();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="space-y-4">
        {/* Profile Image - Left aligned */}
        <div className="flex justify-start">
          <UserAvatar
            profileImage={profileImage}
            username={name}
            size="xl"
            className="w-20 h-20"
          />
        </div>

        {/* Name */}
        <h2 className="text-xl font-semibold text-gray-900">
          {name}
        </h2>

        {/* Followers Count */}
        {followInfo && (
          <p className="text-gray-500">
            <span className="text-gray-700">
              {formatFollowerCount(followInfo.followersCount)}
            </span>
            {' followers'}
          </p>
        )}

        {/* Bio/Description */}
        {description && (
          <p className="text-sm text-gray-600 leading-relaxed">
            {description}
          </p>
        )}

        {/* Follow/Following Button */}
        {userId && !isOwner && isAuthenticated && user && user.id !== userId && (
          <FollowButton
            userId={userId}
            initialState={followInfo}
            className="w-full"
          />
        )}

        {/* Edit Profile for Owner */}
        {isOwner && (
          <button
            onClick={() => router.push('/settings')}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-full hover:bg-gray-50 transition-colors"
          >
            프로필 편집
          </button>
        )}
      </div>
    </div>
  );
});

export default BlogOwnerCard;