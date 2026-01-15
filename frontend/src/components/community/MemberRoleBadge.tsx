'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Shield, Crown, User, ShieldCheck } from 'lucide-react';
import { CommunityRole, type CommunityRoleType } from '@/types/community';

interface MemberRoleBadgeProps {
  role: CommunityRoleType;
  showIcon?: boolean;
  showText?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * 커뮤니티 멤버 역할 배지 컴포넌트
 * Owner, Admin, Manager, Member 4단계 역할을 시각적으로 구분
 */
const MemberRoleBadge = React.memo(function MemberRoleBadge({
  role,
  showIcon = true,
  showText = true,
  size = 'sm',
  className,
}: MemberRoleBadgeProps) {
  // 일반 멤버는 배지를 표시하지 않음 (선택적)
  if (role === CommunityRole.MEMBER) {
    return null;
  }

  const roleConfig = {
    [CommunityRole.OWNER]: {
      label: '오너',
      icon: Crown,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    },
    [CommunityRole.ADMIN]: {
      label: '관리자',
      icon: ShieldCheck,
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    },
    [CommunityRole.MODERATOR]: {
      label: '매니저',
      icon: Shield,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    },
    [CommunityRole.MEMBER]: {
      label: '멤버',
      icon: User,
      className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
    },
  };

  const config = roleConfig[role];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-4 h-4')} />
      )}
      {showText && <span>{config.label}</span>}
    </span>
  );
});

export default MemberRoleBadge;
