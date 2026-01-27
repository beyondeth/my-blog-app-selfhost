"use client";

import { PropsWithChildren, useEffect, useState } from 'react';
import UserProfileCard from './ui/UserProfileCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { User, FollowInfo } from '@/types/api';

interface UserTooltipProps extends PropsWithChildren {
  user: Partial<User> & {
    id: string;
    email: string;
    username: string;
    _count?: {
      followers: number;
      following: number;
      posts?: number;
    };
  };
  followInfo?: FollowInfo;
  isMobile?: boolean;
}

export default function UserTooltip({ children, user, followInfo, isMobile }: UserTooltipProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR/초기 하이드레이션에서는 툴팁/포퍼를 렌더링하지 않아 DOM 불일치 방지
  if (!mounted) {
    return <>{children}</>;
  }

  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 shadow-2xl p-0 rounded-2xl w-auto backdrop-blur-sm z-[10002]"
          sideOffset={12}
        >
          <UserProfileCard user={user} followInfo={followInfo} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          className="bg-white dark:bg-card border border-gray-200 dark:border-gray-700 shadow-2xl p-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 rounded-2xl backdrop-blur-sm z-[10002]"
          sideOffset={12}
          data-portal-modal="true"
        >
          <UserProfileCard user={user} followInfo={followInfo} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
