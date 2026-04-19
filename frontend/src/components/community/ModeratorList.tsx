'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Shield, Crown, Users, ShieldAlert } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { getCommunityModerators } from '@/services/api/community.service';
import { communityQueryKeys } from '@/hooks/community/useCommunities';
import type { CommunityMember, CommunityRoleType, MembershipStatusType } from '@/types/community';
import { CommunityRole, MembershipStatus } from '@/types/community';
import { getBlogUrl } from '@/lib/utils/blogUrl';

interface ModeratorListProps {
  communitySlug: string;
  userMembership?: {
    isMember: boolean;
    status?: MembershipStatusType;
  };
  className?: string;
}

/**
 * Community moderator list
 */
const ModeratorList = React.memo(function ModeratorList({
  communitySlug,
  userMembership,
  className,
}: ModeratorListProps) {
  const { data: moderators, isLoading } = useQuery<CommunityMember[]>({
    queryKey: [...communityQueryKeys.detail(communitySlug), 'moderators'],
    queryFn: () => getCommunityModerators(communitySlug),
    staleTime: 5 * 60 * 1000,
    enabled: !!communitySlug,
  });

  if (isLoading) {
    return (
      <div
        className={cn(
          'bg-white dark:bg-[rgb(38,38,38)] rounded-3xl border border-gray-200 dark:border-gray-700 p-5',
          className
        )}
      >
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Team
          </h3>
        </div>
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!moderators || moderators.length === 0) {
    return null;
  }

  const getRoleInfo = (role: CommunityRoleType) => {
    switch (role) {
      case CommunityRole.OWNER:
        return {
          icon: Crown,
          label: 'Owner',
          className: 'text-amber-500',
        };
      case CommunityRole.MODERATOR:
        return {
          icon: Shield,
          label: 'Moderator',
          className: 'text-green-500',
        };
      default:
        return {
          icon: Users,
          label: 'Member',
          className: 'text-gray-500',
        };
    }
  };

  const sortedModerators = [...moderators].sort((a, b) => {
    if (a.role === CommunityRole.OWNER) return -1;
    if (b.role === CommunityRole.OWNER) return 1;
    return 0;
  });

  const canUseSafetySupport =
    !!userMembership?.isMember && userMembership?.status === MembershipStatus.ACTIVE;
  const reportLink = `/c/${communitySlug}/report-moderator`;

  return (
    <div
      className={cn(
        'bg-white dark:bg-[rgb(38,38,38)] rounded-3xl border border-gray-200 dark:border-gray-700 p-5',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <TooltipProvider delayDuration={250}>
          <DropdownMenu modal={false}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Safety and moderation support"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                Safety and moderation support
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-72 space-y-3 p-3" sideOffset={8}>
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Safety and moderation support
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#C7D1DD]">
                    Use this only for urgent cases such as moderator abuse or community recovery requests.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                asChild={canUseSafetySupport}
                disabled={!canUseSafetySupport}
                className="w-full border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
              >
                {canUseSafetySupport ? (
                  <Link href={reportLink}>Report a moderator / request recovery</Link>
                ) : (
                  <span>Members only</span>
                )}
              </Button>
              {!canUseSafetySupport && (
                <p className="text-xs text-gray-500 dark:text-[#C7D1DD] text-center">
                  This support flow is available to active community members only.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Team
        </h3>
        <span className="text-xs text-gray-400 dark:text-[#C7D1DD] ml-auto">
          {moderators.length}
        </span>
      </div>

      <ul className="space-y-3">
        {sortedModerators.map((moderator, index) => {
          const roleInfo = getRoleInfo(moderator.role);
          const RoleIcon = roleInfo.icon;
          const uniqueKey = moderator.id || moderator.userId || `moderator-${index}`;
          const profileLink =
            moderator.user?.blog
              ? `/${moderator.user.blog.slug}`
              : '#';

          return (
            <li key={uniqueKey}>
              <Link
                href={profileLink}
                className="flex items-center gap-3 group hover:bg-gray-50 dark:hover:bg-gray-800/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
              >
                <UserAvatar
                  profileImage={moderator.user?.profileImage}
                  username={moderator.user?.username || 'Unknown user'}
                  size="sm"
                  className="w-8 h-8"
                />

                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-[#D5DEE8] group-hover:text-gray-900 dark:group-hover:text-gray-100 truncate">
                  {moderator.user?.username || 'Unknown user'}
                </span>

                <span title={roleInfo.label}>
                  <RoleIcon className={cn('w-4 h-4', roleInfo.className)} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
});

export default ModeratorList;
