"use client";

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import UserAvatar from '@/components/ui/UserAvatar';
import FollowButton from '@/components/FollowButton';
import { useAuth } from '@/providers/AuthProviderV2';
import { queryKeys } from '@/lib/queries/keys';
import { cn } from '@/lib/utils';
import { SocialIcon } from '@/components/ui/SocialIcon';
import { FiEdit, FiLink } from 'react-icons/fi';
import { LevelBadge } from '@/components/ui/LevelBadge';
import type { SocialLink } from '@/types';

interface BlogOwnerCardProps {
  name?: string;
  username?: string;
  jobTitle?: string;
  description?: string;
  profileImage?: string | null;
  userId?: string;
  isOwner?: boolean;
  followInfo?: FollowInfo; // 외부에서 전달받을 팔로우 정보
  brandImage?: string | null;
  brandColor?: string | null;
  socialLinks?: SocialLink[];
  className?: string;
}

interface FollowInfo {
  followersCount: number;
  followingCount: number;
  isFollowedByUser: boolean;
}

const BlogOwnerCard = React.memo(function BlogOwnerCard({
  name = "개발자",
  username,
  jobTitle,
  description,
  profileImage,
  userId,
  isOwner = false,
  followInfo: externalFollowInfo, // 외부에서 전달받은 팔로우 정보
  brandImage,
  brandColor,
  socialLinks,
  className,
}: BlogOwnerCardProps) {
  const { isAuthenticated, user } = useAuth();
  
  const followInfoQueryKey = userId
    ? queryKeys.users.followInfo(userId)
    : (['users', 'follow-info', 'anonymous'] as const);

  // 팔로우 정보 조회
  const {
    data: followInfo,
    isLoading: isLoadingFollowInfo,
  } = useQuery<FollowInfo>({
    queryKey: followInfoQueryKey,
    queryFn: async () => {
      if (!userId) {
        throw new Error('사용자 정보를 찾을 수 없습니다.');
      }
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow-info`,
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.error(`[BlogOwnerCard] Follow info API error: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch follow info: ${response.status}`);
      }

      return response.json();
    },
    enabled: !!userId && !isOwner && !externalFollowInfo, // isOwner가 아니고, 외부 정보가 없고, userId가 있을 때만
    staleTime: 30000, // 30초간 캐시 유지
    retry: (failureCount, error) => {
      // 404나 인증 에러는 재시도하지 않음
      if (error?.message?.includes('404') || error?.message?.includes('401')) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  // 외부에서 전달받은 팔로우 정보와 내부에서 조회한 정보 통합
  const finalFollowInfo = externalFollowInfo || followInfo;
  const shouldShowActions =
    Boolean(userId) && !isOwner && isAuthenticated && user && user.id !== userId;

  // isOwner일 경우 AuthProvider의 최신 user.profileImage를 우선 사용하고,
  // 없으면 브랜드 이미지라도 사용해서 비어있는 상태를 방지
  const displayProfileImage = isOwner
    ? user?.profileImage || profileImage || brandImage || undefined
    : profileImage || brandImage || undefined;

  // 팔로워 수 포맷팅 (예: 17.4K)
  const formatFollowerCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      const formatted = (count / 1000).toFixed(1);
      // .0을 제거 (17.0K -> 17K)
      return formatted.endsWith('.0') ? `${Math.floor(count / 1000)}K` : `${formatted}K`;
    }
    return count.toString();
  };

  const bannerBackgroundStyle: React.CSSProperties = brandImage
    ? {
        backgroundImage: `url(${brandImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : {};

  const followerCount = finalFollowInfo?.followersCount ?? 0;
  const followingCount = finalFollowInfo?.followingCount ?? 0;
  const visibleSocialLinks = (socialLinks ?? [])
    .filter((link) => Boolean(link?.platform && link?.url))
    .reverse();

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/70 dark:border-gray-700 bg-white dark:bg-[#262626] shadow-sm transition-all",
        className
      )}
    >
      <div
        className={cn(
          "h-48 w-full relative group/banner",
          !brandImage && "bg-gray-100 dark:bg-gray-800"
        )}
        style={bannerBackgroundStyle}
        aria-label="블로그 브랜드 배경"
      >
        {/* Visibility Gradient for Icons/Text on Image */}
        {brandImage && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
        )}
        
        <div className="absolute left-6 -bottom-9 z-10">
          <div className="relative z-10">
            <UserAvatar
              profileImage={displayProfileImage}
              username={name}
              size="xl"
              className="w-24 h-24 border-4 border-white dark:border-[#262626] shadow-xl bg-white"
            />
            {isOwner && (
              <Link
                href="/settings"
                prefetch={false}
                className="absolute -bottom-1 -right-2 h-7 w-7 rounded-full bg-white text-gray-700 border border-gray-200 shadow-sm flex items-center justify-center hover:bg-gray-50 dark:bg-[#1F2230] dark:text-white dark:border-gray-600 z-10 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-gray-500"
                aria-label="프로필 편집"
              >
                <FiEdit className="w-3 h-3" />
              </Link>
            )}
          </div>
        </div>

        {visibleSocialLinks.length > 0 && (
          <div className="absolute right-6 bottom-2.5 flex items-center gap-1 z-20 pointer-events-auto">
            {visibleSocialLinks.map((link) => {
              const platformKey = link.platform.toLowerCase();
              
              return (
                <a
                  key={`${platformKey}-${link.url}`}
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${link.platform} 링크`}
                  className={cn(
                    "flex h-5 w-5 items-center justify-center transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 pointer-events-auto",
                    brandImage 
                      ? "text-white/80 hover:text-white focus-visible:ring-white/50" 
                      : "text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white focus-visible:ring-gray-400"
                  )}
                >
                  <SocialIcon 
                    platform={platformKey} 
                    className={cn(
                      "h-[16px] w-[16px]",
                      brandImage ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]" : "drop-shadow-sm"
                    )} 
                  />
                </a>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-6 pt-10 pb-6 relative flex flex-col">
        {shouldShowActions && userId && (
          <div className="absolute top-4 right-6">
            <FollowButton
              userId={userId}
              initialState={finalFollowInfo}
              className="rounded-full px-4 py-1 text-[13px] font-medium shadow-md bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-gray-200 transition-all"
              variant="minimal"
              suppressSuccessToast={true}
            />
          </div>
        )}

        <div className="mt-6 space-y-1">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            {name}
            <LevelBadge userId={userId} />
          </h2>
          {jobTitle && (
            <p className="text-sm text-gray-600 dark:text-gray-300">{jobTitle}</p>
          )}
        </div>

        {description && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-4 whitespace-pre-line break-words">
            {description}
          </p>
        )}

        <div className="mt-4 flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          {isLoadingFollowInfo && !externalFollowInfo ? (
            <div className="h-5 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 dark:text-white">{formatFollowerCount(followerCount)}</span>
                <span>팔로워</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 dark:text-white">{formatFollowerCount(followingCount)}</span>
                <span>팔로잉</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default BlogOwnerCard;
