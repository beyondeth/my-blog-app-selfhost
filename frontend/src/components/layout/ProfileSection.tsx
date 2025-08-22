"use client";

import React from 'react';
import { Avatar } from '@/components/ui/avatar';
import SidebarSection from './SidebarSection';

interface ProfileSectionProps {
  name?: string;
  description?: string;
  profileImage?: string | null;
}

const ProfileSection = React.memo(function ProfileSection({ 
  name = "개발자", 
  description = "풀스택 개발자입니다.",
  profileImage
}: ProfileSectionProps) {
  return (
    <SidebarSection title="프로필">
      <div className="flex items-center space-x-3 sm:space-x-3">
        <Avatar 
          src={profileImage} 
          alt={name}
          fallback={name}
          size="xl"
          className="flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-base sm:text-sm font-medium text-gray-900 break-words">{name}</div>
          <div className="text-sm sm:text-xs text-gray-500 break-words leading-relaxed">{description}</div>
        </div>
      </div>
    </SidebarSection>
  );
});

export default ProfileSection; 