'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useInfiniteQuery, useMutation, useQueryClient, InfiniteData } from '@tanstack/react-query';
import { Search, UserMinus, Check, X, Users, UserCheck, Ban } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import UserAvatar from '@/components/ui/UserAvatar';
import Link from 'next/link';
import { useMyBlocks, useBlock } from '@/hooks/useBlock';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
} from '@/app/settings/theme';
import { DESTRUCTIVE_SURFACE_CLASS } from '@/constants/accessibility';

interface User {
  id: string;
  username: string;
  profileImage?: string;
  bio?: string;
  blog?: {
    slug: string;
  };
}

interface CursorPaginatedResponse<T> {
  data: T[];
  total: number;
  hasNext: boolean;
  nextCursor?: string;
  nextCursorId?: string;
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
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Fetch following list (커서 기반 무한 스크롤)
  // Fetch following list (커서 기반 무한 스크롤)
  const {
    data: followingData,
    isLoading: isLoadingFollowing,
    fetchNextPage: fetchNextFollowing,
    hasNextPage: hasNextFollowing,
    isFetchingNextPage: isFetchingNextFollowing,
  } = useInfiniteQuery<CursorPaginatedResponse<User>, Error, InfiniteData<CursorPaginatedResponse<User>>, any[], { cursor?: string; cursorId?: string }>({
    queryKey: ['following', 'list', 'cursor', currentUser?.id],
    queryFn: async ({ pageParam }) => {
      if (!currentUser?.id) return { data: [], total: 0, hasNext: false };
      const params = new URLSearchParams({ limit: '20' });
      const { cursor, cursorId } = pageParam as { cursor?: string; cursorId?: string };
      if (cursor) params.append('cursor', cursor);
      if (cursorId) params.append('cursorId', cursorId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${currentUser.id}/following/cursor?${params}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch following');
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.hasNext && lastPage?.nextCursor && lastPage?.nextCursorId) {
        return { cursor: lastPage.nextCursor, cursorId: lastPage.nextCursorId };
      }
      return undefined;
    },
    initialPageParam: { cursor: undefined, cursorId: undefined },
    enabled: !!currentUser?.id,
  });

  // Fetch followers list (커서 기반 무한 스크롤)
  // Fetch followers list (커서 기반 무한 스크롤)
  const {
    data: followersData,
    isLoading: isLoadingFollowers,
    fetchNextPage: fetchNextFollowers,
    hasNextPage: hasNextFollowers,
    isFetchingNextPage: isFetchingNextFollowers,
  } = useInfiniteQuery<CursorPaginatedResponse<User>, Error, InfiniteData<CursorPaginatedResponse<User>>, any[], { cursor?: string; cursorId?: string }>({
    queryKey: ['followers', 'list', 'cursor', currentUser?.id],
    queryFn: async ({ pageParam }) => {
      if (!currentUser?.id) return { data: [], total: 0, hasNext: false };
      const params = new URLSearchParams({ limit: '20' });
      const { cursor, cursorId } = pageParam as { cursor?: string; cursorId?: string };
      if (cursor) params.append('cursor', cursor);
      if (cursorId) params.append('cursorId', cursorId);
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/users/${currentUser.id}/followers/cursor?${params}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Failed to fetch followers');
      return response.json();
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.hasNext && lastPage?.nextCursor && lastPage?.nextCursorId) {
        return { cursor: lastPage.nextCursor, cursorId: lastPage.nextCursorId };
      }
      return undefined;
    },
    initialPageParam: { cursor: undefined, cursorId: undefined },
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
      showActionFeedback('success', '언팔로우했습니다');
    },
    onError: () => {
      showActionFeedback('error', '언팔로우에 실패했습니다');
    },
  });

  // Remove follower mutation - 현재 백엔드 API 미구현
  const removeFollowerMutation = useMutation({
    mutationFn: async (userId: string) => {
      // TODO: 백엔드에 remove-follower API 추가 필요
      showActionFeedback('info', '이 기능은 아직 준비 중입니다');
      throw new Error('Not implemented');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followers'] });
      showActionFeedback('success', '팔로워를 삭제했습니다');
    },
    onError: () => {
      // 에러 메시지는 mutationFn에서 처리
    },
  });

  // Unfollow 데이터를 플랫하게 합치기 (무한 스크롤용)
  const allFollowing = followingData?.pages?.flatMap((page) => page?.data ?? []) ?? [];
  const allFollowers = followersData?.pages?.flatMap((page) => page?.data ?? []) ?? [];
  const followingTotal = followingData?.pages?.[0]?.total ?? 0;
  const followersTotal = followersData?.pages?.[0]?.total ?? 0;

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
      showActionFeedback('error', '선택된 사용자가 없습니다');
      return;
    }

    const confirmed = confirm(`${selectedUsers.length}명을 언팔로우하시겠습니까?`);
    if (!confirmed) return;

    const count = selectedUsers.length;
    try {
      await Promise.all(selectedUsers.map((userId) => unfollowMutation.mutateAsync(userId)));
      setSelectedUsers([]);
      showActionFeedback('success', `${count}명을 언팔로우했습니다`);
    } catch (error) {
      showActionFeedback('error', '일부 언팔로우에 실패했습니다');
    }
  };

  // Handle bulk unblock
  const handleBulkUnblock = async () => {
    if (selectedUsers.length === 0) {
      showActionFeedback('error', '선택된 사용자가 없습니다');
      return;
    }

    const confirmed = confirm(`${selectedUsers.length}명의 차단을 해제하시겠습니까?`);
    if (!confirmed) return;

    const count = selectedUsers.length;
    try {
      await Promise.all(selectedUsers.map((userId) => unblockUser(userId)));
      setSelectedUsers([]);
      showActionFeedback('success', `${count}명의 차단을 해제했습니다`);
    } catch (error) {
      showActionFeedback('error', '일부 차단 해제에 실패했습니다');
    }
  };

  const showActionFeedback = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    setActionFeedback({ type, text });
    feedbackTimeoutRef.current = setTimeout(() => setActionFeedback(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  // Toggle user selection
  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  // Select all users
  const selectAllUsers = () => {
    let users: User[];
    if (activeTab === 'following') {
      users = allFollowing;
    } else if (activeTab === 'followers') {
      users = allFollowers;
    } else if (activeTab === 'blocked') {
      // blockedData.data는 Block 엔티티 배열이므로 blocked 필드에서 User 정보 추출
      users = blockedData?.data?.map((block: any) => block.blocked) ?? [];
    } else {
      users = [];
    }

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-100 dark:border-[#2F3440] last:border-b-0 gap-3 sm:gap-0 transition-colors hover:bg-gray-50 dark:hover:bg-[#272C36]">
        <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => toggleUserSelection(user.id)}
            aria-pressed={isSelected}
            className={`w-5 h-5 border-[1.5px] rounded-md flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-gray-900 dark:bg-[#6D79FF] border-gray-900 dark:border-[#6D79FF] text-white'
                : 'border-gray-300 dark:border-[#3A414F] text-transparent hover:border-gray-400 dark:hover:border-[#4A5161]'
            }`}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
            <span className="sr-only">사용자 선택</span>
          </button>

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
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300 truncate">{user.bio}</p>
              )}
            </div>
          </Link>
        </div>

        {actionFeedback && (
          <div
            className={`rounded-2xl border p-4 text-sm ${
              actionFeedback.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                : actionFeedback.type === 'error'
                ? `${DESTRUCTIVE_SURFACE_CLASS} text-[#7A271A] dark:text-red-200`
                : 'border-blue-300 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/10 text-blue-800 dark:text-blue-100'
            }`}
          >
            {actionFeedback.text}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {type === 'following' ? (
            <button
              type="button"
              onClick={() => unfollowMutation.mutate(user.id)}
              disabled={unfollowMutation.isPending}
              className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
            >
              언팔로우
            </button>
          ) : (
            <button
              type="button"
              onClick={() => removeFollowerMutation.mutate(user.id)}
              disabled={removeFollowerMutation.isPending}
              className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
            >
              삭제
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="space-y-2 pt-1">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-50">관계 설정</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 dark:text-gray-300">
          Following, Followers, 차단 목록을 한 번에 관리하세요.
        </p>
      </div>

      <div className={`${SETTINGS_CARD_CLASS} p-0 overflow-hidden`}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'following' | 'followers' | 'blocked')}
          className="w-full"
        >
          <TabsList className="flex w-full border-b border-gray-100 dark:border-[#242833] bg-white dark:bg-[#141822] text-sm font-medium text-gray-500 dark:text-gray-300 dark:text-gray-300">
            <TabsTrigger
              value="following"
              className="flex flex-1 items-center justify-center gap-2 min-h-[48px] rounded-none border-b-2 border-transparent text-xs sm:text-sm data-[state=active]:border-[#5850ec] dark:data-[state=active]:border-[#818cf8] data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Following</span>
              <span className="sm:hidden">팔로잉</span>
              ({followingTotal})
            </TabsTrigger>
            <TabsTrigger
              value="followers"
              className="flex flex-1 items-center justify-center gap-2 min-h-[48px] rounded-none border-b-2 border-transparent text-xs sm:text-sm data-[state=active]:border-[#5850ec] dark:data-[state=active]:border-[#818cf8] data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
            >
              <UserCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Followers</span>
              <span className="sm:hidden">팔로워</span>
              ({followersTotal})
            </TabsTrigger>
            <TabsTrigger
              value="blocked"
              className="flex flex-1 items-center justify-center gap-2 min-h-[48px] rounded-none border-b-2 border-transparent text-xs sm:text-sm data-[state=active]:border-[#5850ec] dark:data-[state=active]:border-[#818cf8] data-[state=active]:text-gray-900 dark:data-[state=active]:text-white"
            >
              <Ban className="w-4 h-4" />
              <span className="hidden sm:inline">차단 목록</span>
              <span className="sm:hidden">차단</span>
              ({blockedData?.total || 0})
            </TabsTrigger>
          </TabsList>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="사용자 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${SETTINGS_INPUT_CLASS} pl-10`}
                />
              </div>

              {selectedUsers.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={clearSelection}
                    className={`${SETTINGS_SUBTLE_BUTTON_CLASS} flex-1 sm:flex-initial`}
                  >
                    선택 해제 ({selectedUsers.length})
                  </button>
                  {activeTab === 'following' && (
                    <button
                      type="button"
                      onClick={handleBulkUnfollow}
                      className={`${SETTINGS_PRIMARY_BUTTON_CLASS} flex-1 sm:flex-initial`}
                    >
                      <UserMinus className="w-4 h-4" />
                      <span className="hidden sm:inline">선택 언팔로우</span>
                      <span className="sm:hidden">언팔로우</span>
                    </button>
                  )}
                  {activeTab === 'blocked' && (
                    <button
                      type="button"
                      onClick={handleBulkUnblock}
                      className={`${SETTINGS_PRIMARY_BUTTON_CLASS} flex-1 sm:flex-initial`}
                    >
                      <X className="w-4 h-4" />
                      <span className="hidden sm:inline">선택 차단 해제</span>
                      <span className="sm:hidden">차단 해제</span>
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={selectAllUsers}
                  className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
                >
                  전체 선택
                </button>
              )}
            </div>

            <TabsContent value="following" className="mt-0">
              <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:bg-[#161b27] dark:border-[#242a38] overflow-hidden">
                {isLoadingFollowing ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-300">로딩 중...</div>
                ) : allFollowing.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-300">
                    <Users className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>아직 Following하는 사용자가 없습니다</p>
                  </div>
                ) : (
                  <>
                    {filterUsers(allFollowing).map((user: User) => (
                      <UserCard key={user.id} user={user} type="following" />
                    ))}
                    {filterUsers(allFollowing).length === 0 && searchQuery && (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-300">검색 결과가 없습니다</div>
                    )}
                    {hasNextFollowing && (
                      <div className="p-4 border-t border-gray-100 dark:border-[#2F3440]">
                        <button
                          onClick={() => fetchNextFollowing()}
                          disabled={isFetchingNextFollowing}
                          className="w-full py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                        >
                          {isFetchingNextFollowing ? '로딩 중...' : '더 보기'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="followers" className="mt-0">
              <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:bg-[#161b27] dark:border-[#242a38] overflow-hidden">
                {isLoadingFollowers ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-300">로딩 중...</div>
                ) : allFollowers.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-300">
                    <UserCheck className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p>아직 Followers가 없습니다</p>
                  </div>
                ) : (
                  <>
                    {filterUsers(allFollowers).map((user: User) => (
                      <UserCard key={user.id} user={user} type="follower" />
                    ))}
                    {filterUsers(allFollowers).length === 0 && searchQuery && (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-300">검색 결과가 없습니다</div>
                    )}
                    {hasNextFollowers && (
                      <div className="p-4 border-t border-gray-100 dark:border-[#2F3440]">
                        <button
                          onClick={() => fetchNextFollowers()}
                          disabled={isFetchingNextFollowers}
                          className="w-full py-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                        >
                          {isFetchingNextFollowers ? '로딩 중...' : '더 보기'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="blocked" className="mt-0">
              <div className="rounded-3xl border border-gray-100 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:bg-[#161b27] dark:border-[#242a38] overflow-hidden">
                {isLoadingBlocked ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-300 dark:text-gray-300">로딩 중...</div>
                ) : blockedData?.data?.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-300 dark:text-gray-300">
                    <Ban className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600 dark:text-gray-300" />
                    <p>차단한 사용자가 없습니다</p>
                  </div>
                ) : (
                  <>
                    {filterUsers(blockedData?.data?.map((block: any) => block.blocked) || []).map((user: User) => (
                      <div
                        key={user.id}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-3 sm:px-4 py-3 sm:py-4 border-b border-gray-100 dark:border-[#2F3440] last:border-b-0 gap-3 sm:gap-0 transition-colors hover:bg-gray-50 dark:hover:bg-[#272C36]"
                      >
                        <div className="flex items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => toggleUserSelection(user.id)}
                            aria-pressed={selectedUsers.includes(user.id)}
                            className={`w-5 h-5 border-[1.5px] rounded-md flex items-center justify-center transition-colors ${
                              selectedUsers.includes(user.id)
                                ? 'bg-gray-900 dark:bg-[#6D79FF] border-gray-900 dark:border-[#6D79FF] text-white'
                                : 'border-gray-300 dark:border-[#3A414F] text-transparent hover:border-gray-400 dark:hover:border-[#4A5161]'
                            }`}
                          >
                            {selectedUsers.includes(user.id) && <Check className="w-3 h-3 text-white" />}
                            <span className="sr-only">사용자 선택</span>
                          </button>
                          <Link
                            href={user.blog?.slug ? `/${user.blog.slug}` : '#'}
                            className="flex items-center gap-2 sm:gap-3 flex-1 group min-h-[44px]"
                          >
                            <UserAvatar profileImage={user.profileImage} username={user.username} size="md" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-gray-100 group-hover:text-gray-700 dark:group-hover:text-gray-300">
                                {user.username}
                              </p>
                              {user.bio && <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-300 dark:text-gray-300 truncate">{user.bio}</p>}
                            </div>
                          </Link>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`${user.username}님의 차단을 해제하시겠습니까?`)) {
                                unblockUser(user.id);
                              }
                            }}
                            className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full sm:w-auto`}
                          >
                            차단 해제
                          </button>
                        </div>
                      </div>
                    ))}
                    {filterUsers(blockedData?.data?.map((block: any) => block.blocked) || []).length === 0 && searchQuery && (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-300 dark:text-gray-300">검색 결과가 없습니다</div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
