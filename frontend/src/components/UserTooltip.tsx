"use client";

import { PropsWithChildren } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import FollowButton from './FollowButton';
import UserAvatar from './ui/UserAvatar';
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
  const { user: loggedInUser } = useAuth();

  // Use provided followInfo or create default
  const followerState = followInfo || {
    followersCount: user._count?.followers || 0,
    followingCount: user._count?.following || 0,
    isFollowedByUser: false,
  };

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent 
          className="bg-white border border-gray-200 shadow-2xl p-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 rounded-2xl backdrop-blur-sm"
          sideOffset={12}
        >
          <div className="flex flex-col gap-5 p-6 max-w-sm">
            {/* Header with avatar and follow button */}
            <div className="flex items-start justify-between gap-4">
              <Link href={user.blog ? `/blog/${user.blog.slug}` : '#'} className="group">
                <UserAvatar
                  profileImage={user.profileImage}
                  username={user.username}
                  size="xl"
                  className="transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
                />
              </Link>
              {loggedInUser && loggedInUser.id !== user.id && (
                <div className="flex-shrink-0">
                  <FollowButton 
                    userId={user.id} 
                    initialState={followerState}
                    variant="minimal"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            
            {/* Name and stats */}
            <div className="-mt-2">
              <Link 
                href={user.blog ? `/blog/${user.blog.slug}` : '#'}
                className="group block"
              >
                <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-200 mb-2">
                  {user.username}
                </h3>
              </Link>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="font-semibold text-gray-900">
                    {followerState.followersCount.toLocaleString()}
                  </span>
                  <span className="text-gray-500">Followers</span>
                </div>
              </div>
            </div>
            
            {/* Bio */}
            {user.bio && (
              <p className="text-gray-700 text-sm leading-relaxed line-clamp-3 -mt-1">
                {user.bio}
              </p>
            )}
            
            {/* Blog link if exists */}
            {user.blog && (
              <Link 
                href={`/blog/${user.blog.slug}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-all duration-200 hover:gap-2 group"
              >
                <span>블로그 방문</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}