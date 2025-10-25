"use client";

import React from 'react';
import { FiUsers, FiUserPlus } from 'react-icons/fi';
import UserAvatar from '@/components/ui/UserAvatar';
import SidebarSection from './SidebarSection';
import useFollowInfo from '@/hooks/useFollowInfo';
import FollowButton from '@/components/FollowButton';
import { useAuth } from '@/providers/AuthProviderV2';

interface ProfileSectionProps {
  name?: string;
  description?: string;
  profileImage?: string | null;
  userId?: string;
  isOwner?: boolean;
}

const ProfileSection = React.memo(function ProfileSection({ 
  name = "개발자", 
  description = "풀스택 개발자입니다.",
  profileImage,
  userId,
  isOwner = false
}: ProfileSectionProps) {
  const { isAuthenticated } = useAuth();
  const followInfo = userId ? useFollowInfo(userId, {
    followersCount: 0,
    followingCount: 0,
    isFollowedByUser: false,
  }) : null;

  return (
    <SidebarSection title="프로필">
      <div className="space-y-3">
        <div className="flex items-center space-x-3 sm:space-x-3">
          <UserAvatar
            profileImage={profileImage}
            username={name}
            size="lg"
            className="flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="text-base sm:text-sm font-medium text-gray-900 break-words">{name}</div>
            <div className="text-sm sm:text-xs text-gray-500 break-words leading-relaxed">{description}</div>
          </div>
        </div>
        
        {/* Follow Stats */}
        {followInfo?.followInfo && (
          <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t dark:border-gray-700">
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <FiUsers className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{followInfo.followInfo.followersCount}</span>
                <span className="text-gray-500 dark:text-gray-400">팔로워</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FiUserPlus className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">{followInfo.followInfo.followingCount}</span>
                <span className="text-gray-500 dark:text-gray-400">팔로잉</span>
              </div>
            </div>

            {/* Follow Button */}
            {userId && !isOwner && isAuthenticated && (
              <FollowButton
                userId={userId}
                initialState={followInfo.followInfo}
                variant="minimal"
              />
            )}
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default ProfileSection; 