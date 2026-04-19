"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import FollowButton from './FollowButton';
import UserAvatar from './ui/UserAvatar';
import UserLinkWithTooltip from './UserLinkWithTooltip';
import { queryKeys } from '@/lib/queries/keys';
import { useAuth } from '@/providers/AuthProviderV2';
import { useLocaleContext } from '@/providers/LocaleProvider';
import { cn } from '@/lib/utils';

interface ConnectionsSectionProps {
  userId: string;
}

type TabKey = 'following' | 'followers';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export default function ConnectionsSection({ userId }: ConnectionsSectionProps) {
  const { user: currentUser } = useAuth();
  const { locale, t } = useLocaleContext();
  const [activeTab, setActiveTab] = useState<TabKey>('following');

  const { data: followingData, isLoading: isLoadingFollowing } = useQuery({
    queryKey: queryKeys.users.following(userId),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/following?limit=10`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch following');
      }

      return response.json();
    },
    staleTime: 60 * 1000,
  });

  const { data: followersData, isLoading: isLoadingFollowers } = useQuery({
    queryKey: queryKeys.users.followers(userId),
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/users/${userId}/followers?limit=10`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch followers');
      }

      return response.json();
    },
    staleTime: 60 * 1000,
  });

  const tabs = useMemo(
    () => [
      { key: 'following' as const, label: t('connections.following'), count: followingData?.total || 0 },
      { key: 'followers' as const, label: t('connections.followers'), count: followersData?.total || 0 },
    ],
    [followersData?.total, followingData?.total, t]
  );

  const activeState = useMemo(() => {
    if (activeTab === 'following') {
      return {
        users: followingData?.data ?? [],
        total: followingData?.total || 0,
        isLoading: isLoadingFollowing,
        emptyMessage: t('connections.emptyFollowing'),
      };
    }

    return {
      users: followersData?.data ?? [],
      total: followersData?.total || 0,
      isLoading: isLoadingFollowers,
      emptyMessage: t('connections.emptyFollowers'),
    };
  }, [activeTab, followersData?.data, followersData?.total, followingData?.data, followingData?.total, isLoadingFollowers, isLoadingFollowing, t]);

  const summaryText =
    locale === 'ko'
      ? `총 ${activeState.total.toLocaleString()}명과 연결되어 있어요`
      : `Connected with ${activeState.total.toLocaleString()} people`;

  const renderSkeleton = () => (
    <div className="space-y-3" role="status" aria-live="polite">
      {[...Array(3)].map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 rounded-2xl border border-[#D9E0EA] bg-[#F7F9FC] px-3 py-2 animate-pulse dark:border-[#2A3645] dark:bg-[#131A22]"
        >
          <div className="w-10 h-10 rounded-full bg-[#DCE3EC] dark:bg-[#223040]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-[#DCE3EC] dark:bg-[#223040]" />
            <div className="h-3 w-1/2 rounded bg-[#DCE3EC] dark:bg-[#223040]" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-3xl border border-[#D9E0EA] bg-white p-5 shadow-sm transition-shadow duration-300 hover:shadow-md dark:border-[#4B5563] dark:bg-[#262626]">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#264653] dark:bg-[#6CC3B2]" aria-hidden />
          {t('connections.title')}
        </h3>
        <p className="text-sm text-[#3F4A59] dark:text-[#E1E8F0]">{summaryText}</p>
      </div>

      <div className="mb-5 flex rounded-full bg-[#F7F9FC] p-1 text-sm font-medium dark:bg-[#131A22]">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 rounded-full px-3 py-1.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#264653] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F9FC] dark:focus-visible:ring-[#6CC3B2] dark:focus-visible:ring-offset-[#131A22]',
              activeTab === tab.key
                ? 'bg-white text-[#1B2430] shadow-sm dark:bg-[#1A232E] dark:text-[#E6EDF3]'
                : 'text-[#3F4A59] dark:text-[#E1E8F0]'
            )}
            aria-pressed={activeTab === tab.key}
          >
            <span>{tab.label}</span>
            <span className="ml-1 text-xs text-[#3F4A59] dark:text-[#E1E8F0]">({tab.count || 0})</span>
          </button>
        ))}
      </div>

      {activeState.isLoading ? (
        renderSkeleton()
      ) : activeState.users.length ? (
        <ul className="space-y-2">
          {activeState.users.map((user: any) => (
            <li
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[#D9E0EA] bg-[#F7F9FC] px-3 py-2 transition-colors duration-200 hover:bg-[#EEF3F8] dark:border-[#2A3645] dark:bg-[#131A22] dark:hover:bg-[#1A232E]"
            >
              <UserLinkWithTooltip userId={user.id} username={user.username} blogSlug={user.blog?.slug}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <UserAvatar profileImage={user.profileImage} username={user.username} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold">{user.username}</p>
                    {user.blog?.title && (
                      <p className="truncate text-xs text-[#3F4A59] dark:text-[#E1E8F0]">{user.blog.title}</p>
                    )}
                  </div>
                </div>
              </UserLinkWithTooltip>

              {currentUser && currentUser.id !== user.id && (
                <FollowButton userId={user.id} variant="minimal" suppressSuccessToast />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-6 text-center text-sm text-[#3F4A59] dark:text-[#E1E8F0]">
          {activeState.emptyMessage}
        </div>
      )}
    </div>
  );
}
