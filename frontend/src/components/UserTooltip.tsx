"use client";

import { PropsWithChildren } from 'react';
import UserProfileCard from './ui/UserProfileCard';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { User, FollowInfo } from '@/types/api';

interface UserTooltipProps extends PropsWithChildren {
  user: Partial<User> & {
    id: string;
    email: string;
    username: string;
    _count?: {
      followers: number;
      following: number;
    };
  };
  followInfo?: FollowInfo;
}

export default function UserTooltip({ children, user, followInfo }: UserTooltipProps) {
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