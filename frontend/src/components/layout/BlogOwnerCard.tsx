"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { FiUsers } from 'react-icons/fi';
import UserAvatar from '@/components/ui/UserAvatar';
import FollowButton from '@/components/FollowButton';
import { DMButton } from '@/components/dm/DMButton';
import { useAuth } from '@/providers/AuthProviderV2';
import { queryKeys } from '@/lib/queries/keys';

interface BlogOwnerCardProps {
  name?: string;
  username?: string;
  description?: string;
  profileImage?: string | null;
  userId?: string;
  isOwner?: boolean;
  followInfo?: FollowInfo; // 외부에서 전달받을 팔로우 정보
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
  isOwner = false,
  followInfo: externalFollowInfo // 외부에서 전달받은 팔로우 정보
}: BlogOwnerCardProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  
  // 팔로우 정보 조회
  const {
    data: followInfo,
    isLoading: isLoadingFollowInfo,
    error: followInfoError,
    isError: isFollowInfoError
  } = useQuery<FollowInfo>({
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
        console.error(`[BlogOwnerCard] Follow info API error: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch follow info: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!userId && !isOwner && !externalFollowInfo, // isOwner가 아니고, 외부 정보가 없고, userId가 있을 때만
    staleTime: 30000, // 30초간 캐시 유지
    retry: (failureCount, error) => {
      // 404나 인증 에러는 재시도하지 않음
      if (error?.message?.includes('404') || error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 외부에서 전달받은 팔로우 정보와 내부에서 조회한 정보 통합
  const finalFollowInfo = externalFollowInfo || followInfo;

  // isOwner일 경우 AuthProvider의 최신 user.profileImage를 우선 사용
  const displayProfileImage = isOwner ? (user?.profileImage || profileImage) : profileImage;

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
    <div className="bg-white dark:bg-[rgb(38,38,38)] rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="space-y-4">
        {/* Profile Image - Left aligned */}
        <div className="flex justify-start">
          <UserAvatar
            profileImage={displayProfileImage}
            username={name}
            size="xl"
            className="w-20 h-20"
          />
        </div>

        {/* Name */}
        <h2 className="text-xl font-semibold text-foreground">
          {name}
        </h2>

        {/* Followers Count */}
        {(finalFollowInfo || isFollowInfoError) && (
          <div className="flex items-center gap-1.5 text-sm">
            <FiUsers className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            {isLoadingFollowInfo && !externalFollowInfo ? (
              <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {finalFollowInfo ? formatFollowerCount(finalFollowInfo.followersCount) : '0'}
                </span>
                <span className="text-gray-500 dark:text-gray-400">팔로워</span>
              </>
            )}
          </div>
        )}

        {/* Bio/Description */}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed whitespace-pre-wrap break-words">
            {description}
          </p>
        )}

        {/* Follow/Following Button and DM Button */}
        {userId && !isOwner && isAuthenticated && user && user.id !== userId && (
          <div className="flex gap-2 w-full">
            <FollowButton
              userId={userId}
              initialState={finalFollowInfo}
              variant="minimal"
              className="flex-1"
            />
            <DMButton
              userId={userId}
              username={username}
            />
          </div>
        )}

        {/* Edit Profile for Owner */}
        {isOwner && (
          <button
            onClick={() => router.push('/settings')}
            className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            프로필 편집
          </button>
        )}
      </div>
    </div>
  );
});

export default BlogOwnerCard;