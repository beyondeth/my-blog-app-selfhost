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
 * 매니저 목록 컴포넌트
 * 커뮤니티의 오너와 매니저를 표시
 */
const ModeratorList = React.memo(function ModeratorList({
  communitySlug,
  userMembership,
  className,
}: ModeratorListProps) {
  // 매니저 목록 조회
  const { data: moderators, isLoading } = useQuery<CommunityMember[]>({
    queryKey: [...communityQueryKeys.detail(communitySlug), 'moderators'],
    queryFn: () => getCommunityModerators(communitySlug),
    staleTime: 5 * 60 * 1000, // 5분
    enabled: !!communitySlug,
  });

  // 로딩 상태
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
            매니저
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

  // 매니저가 없는 경우 표시하지 않음
  if (!moderators || moderators.length === 0) {
    return null;
  }

  // 역할별 아이콘 및 라벨
  const getRoleInfo = (role: CommunityRoleType) => {
    switch (role) {
      case CommunityRole.OWNER:
        return {
          icon: Crown,
          label: '오너',
          className: 'text-amber-500',
        };
      case CommunityRole.MODERATOR:
        return {
          icon: Shield,
          label: '매니저',
          className: 'text-green-500',
        };
      default:
        return {
          icon: Users,
          label: '멤버',
          className: 'text-gray-500',
        };
    }
  };

  // 오너를 먼저, 그 다음 매니저 순서로 정렬
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
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <TooltipProvider delayDuration={250}>
          <DropdownMenu modal={false}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="안전 / 운영 지원"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                안전 / 운영 지원
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-72 space-y-3 p-3" sideOffset={8}>
              <div className="flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    안전 / 운영 지원
                  </p>
                  <p className="text-xs text-gray-600 dark:text-[#C7D1DD]">
                    매니저 남용 신고, 커뮤니티 복구 요청 등 긴급 상황에만 이용해주세요.
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
                  <Link href={reportLink}>매니저 신고 / 복구 요청</Link>
                ) : (
                  <span>멤버 전용 기능</span>
                )}
              </Button>
              {!canUseSafetySupport && (
                <p className="text-xs text-gray-500 dark:text-[#C7D1DD] text-center">
                  커뮤니티 멤버만 이용할 수 있는 기능입니다.
                </p>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          매니저
        </h3>
        <span className="text-xs text-gray-400 dark:text-[#C7D1DD] ml-auto">
          {moderators.length}명
        </span>
      </div>

      {/* 매니저 목록 */}
      <ul className="space-y-3">
        {sortedModerators.map((moderator, index) => {
          const roleInfo = getRoleInfo(moderator.role);
          const RoleIcon = roleInfo.icon;
          // 고유한 key 보장 (id -> userId -> index 순서로 fallback)
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
                {/* 프로필 이미지 */}
                <UserAvatar
                  profileImage={moderator.user?.profileImage}
                  username={moderator.user?.username || '알 수 없음'}
                  size="sm"
                  className="w-8 h-8"
                />

                {/* 사용자명 */}
                <span className="flex-1 text-sm font-medium text-gray-700 dark:text-[#D5DEE8] group-hover:text-gray-900 dark:group-hover:text-gray-100 truncate">
                  {moderator.user?.username || '알 수 없음'}
                </span>

                {/* 역할 아이콘 */}
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
