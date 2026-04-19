'use client';

import Link from 'next/link';
import { useAuth } from '@/providers/AuthProviderV2';
import FollowButton from '../FollowButton';
import { DMButton } from '../dm/DMButton';
import UserAvatar from './UserAvatar';
import { getBlogLinkFromUser } from '@/lib/utils/blogUrl';
import { useLocaleContext } from '@/providers/LocaleProvider';

interface UserProfileCardWithActionsProps {
  user: {
    id: string;
    username: string;
    profileImage?: string | null;
    bio?: string | null;
    _count?: {
      followers: number;
      following: number;
    };
    blog?: {
      slug: string;
    };
  };
  followInfo?: {
    followersCount: number;
    followingCount: number;
    isFollowedByUser: boolean;
  };
  onReport?: () => void;
  onBlock?: () => void;
}

export default function UserProfileCardWithActions({
  user,
  followInfo,
  onReport,
  onBlock
}: UserProfileCardWithActionsProps) {
  const { user: loggedInUser } = useAuth();
  const { t } = useLocaleContext();

  // Use provided followInfo or create default
  const followerState = followInfo || {
    followersCount: user._count?.followers || 0,
    followingCount: user._count?.following || 0,
    isFollowedByUser: false,
  };

  return (
    <div className="flex flex-col gap-5 p-6 max-w-sm">
      {/* Header with avatar and action buttons */}
      <div className="flex items-start justify-between gap-4">
        <Link href={getBlogLinkFromUser(user)} className="group">
          <UserAvatar
            profileImage={user.profileImage}
            username={user.username}
            size="xl"
            className="transition-all duration-300 group-hover:scale-105 group-hover:shadow-lg"
          />
        </Link>
        {loggedInUser && loggedInUser.id !== user.id && (
          <div className="flex-shrink-0 flex flex-col gap-2">
            <FollowButton
              userId={user.id}
              initialState={followerState}
              variant="minimal"
              className="mt-1"
            />
            <DMButton
              userId={user.id}
              username={user.username}
              size="sm"
            />

            {/* 구분선 */}
            <div className="w-full h-px bg-gray-200 dark:bg-gray-700 my-1" />

            {/* 신고/차단 버튼 */}
            {onReport && (
              <button
                onClick={onReport}
                className="h-8 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
              >
                {t('profileCard.report')}
              </button>
            )}
            {onBlock && (
              <button
                onClick={onBlock}
                className="h-8 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-center"
              >
                {t('profileCard.block')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Name and stats */}
      <div className="-mt-2">
        <Link
          href={user.blog ? `/${user.blog.slug}` : '#'}
          className="group block"
        >
          <h3 className="text-xl font-bold text-gray-900 dark:text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200 mb-2">
            {user.username}
          </h3>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-900 dark:text-foreground">
              {followerState.followersCount.toLocaleString()}
            </span>
            <span className="text-gray-500 dark:text-gray-400">{t('profileCard.followers')}</span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed line-clamp-3 -mt-1">
          {user.bio}
        </p>
      )}

      {/* Blog link if exists */}
      {user.blog && (
        <Link
          href={`/${user.blog.slug}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-all duration-200 hover:gap-2 group"
        >
          <span>{t('profileCard.visitBlog')}</span>
          <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
        </Link>
      )}
    </div>
  );
}
