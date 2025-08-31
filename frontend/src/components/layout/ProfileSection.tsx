"use client";

import React from 'react';
import UserAvatar from '@/components/ui/UserAvatar';
import SidebarSection from './SidebarSection';
import useFollowInfo from '@/hooks/useFollowInfo';
import FollowButton from '@/components/FollowButton';
import { useAuth } from '@/hooks/useAuth';

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
        {followInfo?.data && (
          <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
            <div className="flex gap-4">
              <div>
                <span className="font-medium">{followInfo.data.followersCount}</span>
                <span className="ml-1 text-gray-500">Followers</span>
              </div>
              <div>
                <span className="font-medium">{followInfo.data.followingCount}</span>
                <span className="ml-1 text-gray-500">Following</span>
              </div>
            </div>
            
            {/* Follow Button */}
            {userId && !isOwner && isAuthenticated && (
              <FollowButton
                userId={userId}
                initialState={followInfo.data}
              />
            )}
          </div>
        )}
      </div>
    </SidebarSection>
  );
});

export default ProfileSection; 