'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, UserMinus, Check, X, Users, UserCheck, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import UserAvatar from '@/components/ui/UserAvatar';
import Link from 'next/link';
import { useMyBlocks, useBlock } from '@/hooks/useBlock';

interface User {
  id: string;
  username: string;
  profileImage?: string;
  bio?: string;
  blog?: {
    slug: string;
  };
}

interface FollowInfo {
  followersCount: number;
  followingCount: number;
  isFollowedByUser: boolean;
}

export default function RelationshipsPage() {
  const [activeTab, setActiveTab] = useState<'following' | 'followers' | 'blocked'>('following');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Get current user info first
  const { data: currentUser } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/auth/me`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Not authenticated');
      return response.json();
    },
  });

  // Fetch following list
  const { data: followingData, isLoading: isLoadingFollowing } = useQuery({
    queryKey: ['following', 'list', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${currentUser.id}/following?limit=100`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch following');
      return response.json();
    },
    enabled: !!currentUser?.id,
  });

  // Fetch followers list
  const { data: followersData, isLoading: isLoadingFollowers } = useQuery({
    queryKey: ['followers', 'list', currentUser?.id],
    queryFn: async () => {
      if (!currentUser?.id) return null;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${currentUser.id}/followers?limit=100`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch followers');
      return response.json();
    },
    enabled: !!currentUser?.id,
  });

  // Fetch blocked users list
  const { data: blockedData, isLoading: isLoadingBlocked } = useMyBlocks(1, 100);

  // Unblock functionality
  const { unblockUser } = useBlock();

  // Unfollow mutation
  const unfollowMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${userId}/follow`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (!response.ok) throw new Error('Failed to unfollow');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['following'] });
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      toast.success('언팔로우했습니다');
    },
    onError: () => {
      toast.error('언팔로우 실패');
    },
  });

  // Remove follower mutation - 현재 백엔드 API 미구현
  const removeFollowerMutation = useMutation({
    mutationFn: async (userId: string) => {
      // TODO: 백엔드에 remove-follower API 추가 필요
      toast.info('이 기능은 아직 준비 중입니다');
      throw new Error('Not implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      toast.success('팔로워를 삭제했습니다');
    },
    onError: () => {
      // 에러 메시지는 mutationFn에서 처리
    },
  });

  // Filter users based on search query
  const filterUsers = (users: User[]) => {
    if (!searchQuery) return users;
    return users.filter(
      (user) =>
        user.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.bio?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  // Handle bulk unfollow
  const handleBulkUnfollow = async () => {
    if (selectedUsers.length === 0) {
      toast.error('선택된 사용자가 없습니다');
      return;
    }

    const confirmed = confirm(`${selectedUsers.length}명을 언팔로우하시겠습니까?`);
    if (!confirmed) return;

    try {
      await Promise.all(selectedUsers.map((userId) => unfollowMutation.mutateAsync(userId)));
      setSelectedUsers([]);
      toast.success(`${selectedUsers.length}명을 언팔로우했습니다`);
    } catch (error) {
      toast.error('일부 언팔로우 실패');
    }
  };

  // Handle bulk unblock
  const handleBulkUnblock = async () => {
    if (selectedUsers.length === 0) {
      toast.error('선택된 사용자가 없습니다');
      return;
    }

    const confirmed = confirm(`${selectedUsers.length}명의 차단을 해제하시겠습니까?`);
    if (!confirmed) return;

    try {
      await Promise.all(selectedUsers.map((userId) => unblockUser(userId)));
      setSelectedUsers([]);
      toast.success(`${selectedUsers.length}명의 차단을 해제했습니다`);
    } catch (error) {
      toast.error('일부 차단 해제 실패');
    }
  };

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Select all users
  const selectAllUsers = () => {
    let users;
    if (activeTab === 'following') {
      users = followingData?.data;
    } else if (activeTab === 'followers') {
      users = followersData?.data;
    } else if (activeTab === 'blocked') {
      // blockedData.data는 Block 엔티티 배열이므로 blocked 필드에서 User 정보 추출
      users = blockedData?.data?.map((block: any) => block.blocked);
    }
    if (!users) return;

    const filteredUsers = filterUsers(users);
    const allUserIds = filteredUsers.map((user: User) => user.id);
    setSelectedUsers(allUserIds);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedUsers([]);
  };

  const UserCard = ({ user, type }: { user: User; type: 'following' | 'follower' }) => {
    const isSelected = selectedUsers.includes(user.id);

    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
          {/* Checkbox */}
          <div
            onClick={() => toggleUserSelection(user.id)}
            className={`min-w-[44px] min-h-[44px] w-6 h-6 sm:w-5 sm:h-5 border-2 rounded cursor-pointer flex items-center justify-center transition-colors ${
              isSelected ? 'bg-black dark:bg-gray-600 border-black dark:border-gray-600' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            {isSelected && <Check className="w-4 h-4 sm:w-3 sm:h-3 text-white" />}
          </div>

          {/* User Info */}
          <Link
            href={user.blog?.slug ? `/${user.blog.slug}` : '#'}
            className="flex items-center gap-2 sm:gap-3 flex-1 group min-h-[44px]"
          >
            <UserAvatar
              profileImage={user.profileImage}
              username={user.username}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                {user.username}
              </p>
              {user.bio && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{user.bio}</p>
              )}
            </div>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {type === 'following' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => unfollowMutation.mutate(user.id)}
              disabled={unfollowMutation.isPending}
              className="min-h-[44px] w-full sm:w-auto"
            >
              언팔로우
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => removeFollowerMutation.mutate(user.id)}
              disabled={removeFollowerMutation.isPending}
              className="min-h-[44px] w-full sm:w-auto"
            >
              삭제
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 sm:mb-6">
        <h2 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">관계 설정</h2>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
          Following과 Followers를 관리하고 관계를 설정하세요
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'following' | 'followers' | 'blocked')} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 sm:mb-6 min-h-[44px]">
          <TabsTrigger value="following" className="flex items-center gap-1 sm:gap-2 min-h-[44px] text-xs sm:text-sm px-1 sm:px-3">
            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Following</span><span className="sm:hidden">팔로잉</span> ({followingData?.total || 0})
          </TabsTrigger>
          <TabsTrigger value="followers" className="flex items-center gap-1 sm:gap-2 min-h-[44px] text-xs sm:text-sm px-1 sm:px-3">
            <UserCheck className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Followers</span><span className="sm:hidden">팔로워</span> ({followersData?.total || 0})
          </TabsTrigger>
          <TabsTrigger value="blocked" className="flex items-center gap-1 sm:gap-2 min-h-[44px] text-xs sm:text-sm px-1 sm:px-3">
            <Ban className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">차단 목록</span><span className="sm:hidden">차단</span> ({blockedData?.total || 0})
          </TabsTrigger>
        </TabsList>

        {/* Search and Actions Bar */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="사용자 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 min-h-[44px]"
            />
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={clearSelection}
                className="min-h-[44px] flex-1 sm:flex-initial"
              >
                선택 해제 ({selectedUsers.length})
              </Button>
              {activeTab === 'following' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkUnfollow}
                  className="flex items-center justify-center gap-2 min-h-[44px] flex-1 sm:flex-initial"
                >
                  <UserMinus className="w-4 h-4" />
                  <span className="hidden sm:inline">선택 언팔로우</span><span className="sm:hidden">언팔로우</span>
                </Button>
              )}
              {activeTab === 'blocked' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkUnblock}
                  className="flex items-center justify-center gap-2 min-h-[44px] flex-1 sm:flex-initial"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">선택 차단 해제</span><span className="sm:hidden">차단 해제</span>
                </Button>
              )}
            </div>
          )}

          {selectedUsers.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllUsers}
              className="min-h-[44px]"
            >
              전체 선택
            </Button>
          )}
        </div>

        <TabsContent value="following" className="mt-0">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            {isLoadingFollowing ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : followingData?.data?.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>아직 Following하는 사용자가 없습니다</p>
              </div>
            ) : (
              <div>
                {filterUsers(followingData?.data || []).map((user: User) => (
                  <UserCard key={user.id} user={user} type="following" />
                ))}
                {filterUsers(followingData?.data || []).length === 0 && searchQuery && (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    검색 결과가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="followers" className="mt-0">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            {isLoadingFollowers ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : followersData?.data?.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>아직 Followers가 없습니다</p>
              </div>
            ) : (
              <div>
                {filterUsers(followersData?.data || []).map((user: User) => (
                  <UserCard key={user.id} user={user} type="follower" />
                ))}
                {filterUsers(followersData?.data || []).length === 0 && searchQuery && (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    검색 결과가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="blocked" className="mt-0">
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
            {isLoadingBlocked ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">로딩 중...</div>
            ) : blockedData?.data?.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Ban className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                <p>차단한 사용자가 없습니다</p>
              </div>
            ) : (
              <div>
                {filterUsers(blockedData?.data?.map((block: any) => block.blocked) || []).map((user: User) => (
                  <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-3 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
                      {/* Checkbox */}
                      <div
                        onClick={() => toggleUserSelection(user.id)}
                        className={`min-w-[44px] min-h-[44px] w-6 h-6 sm:w-5 sm:h-5 border-2 rounded cursor-pointer flex items-center justify-center transition-colors ${
                          selectedUsers.includes(user.id)
                            ? 'bg-black dark:bg-gray-600 border-black dark:border-gray-600'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        {selectedUsers.includes(user.id) && <Check className="w-4 h-4 sm:w-3 sm:h-3 text-white" />}
                      </div>

                      {/* User Info */}
                      <Link
                        href={user.blog?.slug ? `/${user.blog.slug}` : '#'}
                        className="flex items-center gap-2 sm:gap-3 flex-1 group min-h-[44px]"
                      >
                        <UserAvatar
                          profileImage={user.profileImage}
                          username={user.username}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                            {user.username}
                          </p>
                          {user.bio && (
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{user.bio}</p>
                          )}
                        </div>
                      </Link>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm(`${user.username}님의 차단을 해제하시겠습니까?`)) {
                            unblockUser(user.id);
                          }
                        }}
                        className="min-h-[44px] w-full sm:w-auto"
                      >
                        차단 해제
                      </Button>
                    </div>
                  </div>
                ))}
                {filterUsers(blockedData?.data?.map((block: any) => block.blocked) || []).length === 0 && searchQuery && (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    검색 결과가 없습니다
                  </div>
                )}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}