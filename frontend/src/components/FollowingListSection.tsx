"use client";

import { useQuery } from '@tanstack/react-query';
import FollowButton from './FollowButton';
import UserAvatar from './ui/UserAvatar';
import UserLinkWithTooltip from './UserLinkWithTooltip';
import { useAuth } from '@/providers/AuthProviderV2';
import { queryKeys } from '@/lib/queries/keys';

interface FollowingListSectionProps {
  userId: string;
}

export default function FollowingListSection({ userId }: FollowingListSectionProps) {
  const { user: currentUser } = useAuth();

  // Fetch following list
  const { data: followingData, isLoading: isLoadingFollowing } = useQuery({
    queryKey: queryKeys.users.following(userId),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/following?limit=10`,
        {
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch following');
      }
      
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch followers list
  const { data: followersData, isLoading: isLoadingFollowers } = useQuery({
    queryKey: queryKeys.users.followers(userId),
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/followers?limit=10`,
        {
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch followers');
      }
      
      return response.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });

  return (
    <div className="space-y-6">
      {/* Following Section */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <div className="w-2 h-2 bg-accent rounded-full"></div>
          Following <span className="text-sm font-normal text-gray-500 dark:text-[#9CA3AF]">({followingData?.total || 0})</span>
        </h3>
        
        {isLoadingFollowing ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        ) : followingData?.data?.length > 0 ? (
          <div className="space-y-4">
            {followingData.data.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between gap-3 p-2 rounded-lg text-gray-900 dark:text-[#9CA3AF] hover:bg-accent hover:text-accent-foreground transition-colors duration-200">
                <UserLinkWithTooltip
                  userId={user.id}
                  username={user.username}
                  blogSlug={user.blog?.slug}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar
                      profileImage={user.profileImage}
                      username={user.username}
                      size="sm"
                      className="ring-2 ring-transparent group-hover:ring-blue-200 transition-all duration-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {user.username}
                      </p>
                    </div>
                  </div>
                </UserLinkWithTooltip>
                {currentUser && currentUser.id !== user.id && (
                  <div className="flex-shrink-0">
                    <FollowButton 
                      userId={user.id} 
                      variant="minimal"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full opacity-50"></div>
            </div>
            <p className="text-sm text-gray-500 dark:text-[#9CA3AF]">"아무도 안 따라가면 길을 잃을지도?"</p>
          </div>
        )}
      </div>

      {/* Followers Section */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow duration-300">
        <h3 className="text-lg font-semibold text-foreground mb-5 flex items-center gap-2">
          <div className="w-2 h-2 bg-accent rounded-full"></div>
          Followers <span className="text-sm font-normal text-gray-500 dark:text-[#9CA3AF]">({followersData?.total || 0})</span>
        </h3>
        
        {isLoadingFollowers ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-32"></div>
                </div>
              </div>
            ))}
          </div>
        ) : followersData?.data?.length > 0 ? (
          <div className="space-y-4">
            {followersData.data.map((user: any) => (
              <div key={user.id} className="flex items-center justify-between gap-3 p-2 rounded-lg text-gray-900 dark:text-[#9CA3AF] hover:bg-accent hover:text-accent-foreground transition-colors duration-200">
                <UserLinkWithTooltip
                  userId={user.id}
                  username={user.username}
                  blogSlug={user.blog?.slug}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <UserAvatar
                      profileImage={user.profileImage}
                      username={user.username}
                      size="sm"
                      className="ring-2 ring-transparent group-hover:ring-green-200 transition-all duration-300"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">
                        {user.username}
                      </p>
                    </div>
                  </div>
                </UserLinkWithTooltip>
                {/* Follow button shown for followers - these are people following me */}
                {currentUser && currentUser.id !== user.id && (
                  <div className="flex-shrink-0">
                    <FollowButton 
                      userId={user.id} 
                      variant="minimal"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full opacity-50"></div>
            </div>
            <p className="text-sm text-gray-500 dark:text-[#9CA3AF]">"첫 팬은 언제나 특별하죠. 곧 찾아올 거예요!"</p>
          </div>
        )}
      </div>
    </div>
  );
}