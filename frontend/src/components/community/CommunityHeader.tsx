'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Lock, Settings, Plus } from 'lucide-react';
import { useAuth } from '@/providers/AuthProviderV2';
import JoinButton from './JoinButton';
import MemberRoleBadge from './MemberRoleBadge';
import { Button } from '@/components/ui/button';
import type { Community } from '@/types/community';
import { isModeratorOrAbove, isOwner } from '@/types/community';
import CommunityLockBanner from './CommunityLockBanner';
import { normalizeImageUrl } from '@/utils/imageUtils';

interface CommunityHeaderProps {
  community: Community;
  className?: string;
}

/**
 * 커뮤니티 헤더 컴포넌트
 * 배너, 아이콘, 이름, 통계, 가입 버튼 등 표시
 */
const CommunityHeader = React.memo(function CommunityHeader({
  community,
  className,
}: CommunityHeaderProps) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const userRole = community.userMembership?.role;
  const isMember = community.userMembership?.isMember || false;
  const canManage = isModeratorOrAbove(userRole);
  const isOwnerUser = isOwner(userRole);
  const isSiteAdmin = user?.role === 'admin';
  const isCommunityLocked = community.isLocked;

  const communityLabel = community.name
    ? `c/${community.name}`
    : `c/${community.slug}`;
  const iconFit = community.iconImageFit ?? 'contain';
  const bannerFit = community.bannerImageFit ?? 'cover';
  const bannerUrl = community.bannerUrl ? normalizeImageUrl(community.bannerUrl) : '';
  const iconUrl = community.iconUrl ? normalizeImageUrl(community.iconUrl) : '';
  const iconContainerClass = cn(
    'relative z-10 flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-white dark:border-gray-900 overflow-hidden shadow-lg flex items-center justify-center',
    iconFit === 'cover' ? 'bg-white dark:bg-gray-800' : 'bg-white dark:bg-gray-900 p-2'
  );
  const iconImageClass = iconFit === 'cover' ? 'object-cover' : 'object-contain';
  const bannerImageClass = bannerFit === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <div className={cn('bg-white dark:bg-gray-900', className)}>
      {/* 배너 이미지 */}
      <div
        className={cn(
          'relative h-32 sm:h-48 overflow-hidden',
          bannerFit === 'cover'
            ? 'bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-800 dark:to-gray-700'
            : 'bg-white dark:bg-gray-900'
        )}
      >
        {bannerUrl && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bannerUrl}
              alt={`${community.name} 배너`}
              className={cn('w-full h-full', bannerImageClass)}
            />
          </>
        )}
      </div>

      {/* 커뮤니티 정보 */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 -mt-8 sm:-mt-12 pb-4 border-b border-gray-200 dark:border-gray-700">
          {/* 커뮤니티 아이콘 */}
          <div className={iconContainerClass}>
            {iconUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={iconUrl}
                  alt={community.name}
                  className={cn('w-full h-full', iconImageClass)}
                />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center">
                <span className="text-3xl sm:text-4xl font-bold text-gray-500 dark:text-gray-400">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </div>

          {/* 이름 및 정보 */}
          <div className="flex-1 pt-4 sm:pt-2 sm:ml-6">
            <div className="flex flex-wrap items-center gap-2 mt-2 text-base text-gray-600 dark:text-gray-300">
              <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-gray-100">
                {communityLabel}
              </h1>
              {!community.isPublic && (
                <Lock className="w-5 h-5 text-gray-400" />
              )}
              {community.isNsfw && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded">
                  NSFW
                </span>
              )}
              {userRole && <MemberRoleBadge role={userRole} />}
            </div>
          </div>

          {/* 액션 버튼들 */}
          <div className="flex items-center gap-2 pt-4 sm:pt-0">
            {/* 가입/탈퇴 버튼 */}
            {isAuthenticated && (
              <JoinButton
                communitySlug={community.slug}
                userMembership={community.userMembership}
              />
            )}

            {/* 게시물 작성 버튼 (멤버만) */}
            {isMember && (
              <Button
                onClick={() => router.push(`/c/${community.slug}/submit`)}
                disabled={isCommunityLocked}
                title={isCommunityLocked ? '커뮤니티가 잠금 상태에서는 게시물을 작성할 수 없습니다.' : undefined}
                className="inline-flex items-center gap-2 bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
              >
                <Plus className="w-4 h-4" />
                <span className="text-xs sm:text-sm font-semibold">게시물 만들기</span>
              </Button>
            )}

            {/* 설정 버튼 (매니저 이상) */}
            {canManage && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push(`/c/${community.slug}/settings`)}
                title="커뮤니티 설정"
                className="border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-700"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <CommunityLockBanner
          isLocked={isCommunityLocked}
          lockedAt={community.lockedAt}
          lockedBy={community.lockedBy}
          communitySlug={community.slug}
          showAdminLink={isSiteAdmin}
          adminHref={`/admin/communities/${community.slug}/recovery`}
          className="mb-6"
        />
      </div>
    </div>
  );
});

export default CommunityHeader;
