'use client';

import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Lock, ShieldCheck, LayoutDashboard } from 'lucide-react';
import JoinButton from './JoinButton';
import type { Community } from '@/types/community';
import { useAuth } from '@/providers/AuthProviderV2';
import { useRouter } from 'next/navigation';

interface CommunityCardProps {
  community: Community;
  showJoinButton?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}

/**
 * 커뮤니티 카드 컴포넌트
 * 커뮤니티 목록에서 각 커뮤니티를 표시하는 카드
 */
const CommunityCard = React.memo(function CommunityCard({
  community,
  showJoinButton = true,
  variant = 'default',
  className,
}: CommunityCardProps) {
  const { user } = useAuth();
  const router = useRouter();
  // 멤버 수 포맷팅 (예: 17.4K)
  const formatCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      const formatted = (count / 1000).toFixed(1);
      return formatted.endsWith('.0') ? `${Math.floor(count / 1000)}K` : `${formatted}K`;
    }
    return count.toString();
  };

  const isOwner = Boolean(
    community.userMembership?.role === 'owner' ||
      (community.creatorId && user?.id && community.creatorId === user.id)
  );
  const iconFit = community.iconImageFit ?? 'contain';
  const getIconContainerClasses = (size: 'sm' | 'md') =>
    cn(
      'flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden',
      size === 'sm' ? 'w-10 h-10' : 'w-12 h-12',
      iconFit === 'cover'
        ? 'bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-50 dark:to-gray-200 border border-transparent dark:border-white/20'
        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 p-1'
    );
  const iconImageClass = iconFit === 'cover' ? 'object-cover' : 'object-contain';

  // compact variant
  if (variant === 'compact') {
    return (
      <Link
        href={`/c/${community.slug}`}
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg',
          'hover:bg-gray-50 dark:hover:bg-gray-800/50',
          'transition-colors duration-200',
          className
        )}
      >
        {/* 아이콘 */}
        <div className={getIconContainerClasses('sm')}>
          {community.iconUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={community.iconUrl}
                alt={community.name}
                className={cn('w-full h-full', iconImageClass)}
              />
            </>
          ) : (
            <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
              {community.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              c/{community.slug}
            </span>
            {!community.isPublic && (
              <Lock className="w-3.5 h-3.5 text-gray-400" />
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatCount(community.memberCount)} members
          </p>
        </div>
      </Link>
    );
  }

  const showActionControls = showJoinButton;

  // default variant (레딧 스타일)
  return (
    <div
      className={cn(
        'bg-white dark:bg-[rgb(38,38,38)] rounded-xl border border-gray-200 dark:border-gray-700',
        'p-4 shadow-sm hover:shadow-md transition-shadow duration-300',
        className
      )}
    >
      {/* 헤더: 아이콘 + 정보 + 상태 */}
      <div className="flex items-start gap-3">
        {/* 아이콘 */}
        <Link href={`/c/${community.slug}`} className="flex-shrink-0">
          <div className={getIconContainerClasses('md')}>
            {community.iconUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={community.iconUrl}
                  alt={community.name}
                  className={cn('w-full h-full', iconImageClass)}
                />
              </>
            ) : (
              <span className="text-lg font-bold text-gray-500 dark:text-gray-400">
                {community.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>

        {/* 이름 + CTA */}
        <div className="flex flex-wrap gap-3 flex-1 min-w-0">
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <Link href={`/c/${community.slug}`} className="group">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                {community.name}
              </h3>
            </Link>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400">
              {!community.isPublic && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              )}
              <span>
                {formatCount(community.memberCount)} members
              </span>
              {community.isNsfw && (
                <span className="text-red-600 dark:text-red-300 font-semibold uppercase tracking-wide">
                  NSFW
                </span>
              )}
            </div>
          </div>

          {showActionControls && (
            <div className="flex flex-col items-end">
              {isOwner ? (
                <button
                  onClick={() => router.push(`/c/${community.slug}`)}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>My</span>
                </button>
              ) : (
                <JoinButton
                  communitySlug={community.slug}
                  userMembership={community.userMembership}
                  variant="minimal"
                  className="justify-center"
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 설명 (2줄 제한) */}
      {community.description && (
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
          {community.description}
        </p>
      )}
    </div>
  );
});

export default CommunityCard;
