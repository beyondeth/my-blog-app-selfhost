'use client';

import { useState, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCommunity } from '@/hooks/community';
import {
  useCommunityMembers,
  useUpdateMemberRole,
  useBanMember,
  useUnbanMember,
  useCommunityBans,
} from '@/hooks/community/useCommunityMembers';
import {
  Users,
  Shield,
  Crown,
  UserCog,
  Search,
  MoreHorizontal,
  Ban,
  UserMinus,
  ChevronDown,
} from 'lucide-react';
import CommunityAdminLayout from '@/components/community/CommunityAdminLayout';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import UserAvatar from '@/components/ui/UserAvatar';
import MemberRoleBadge from '@/components/community/MemberRoleBadge';
import { cn } from '@/lib/utils';
import {
  CommunityRole,
  type CommunityRoleType,
  isOwner,
  isAdminOrAbove,
  isModeratorOrAbove,
} from '@/types/community';
import {
  SETTINGS_CARD_CLASS,
  SETTINGS_INPUT_CLASS,
  SETTINGS_PRIMARY_BUTTON_CLASS,
  SETTINGS_SUBTLE_BUTTON_CLASS,
  SETTINGS_SECTION_TITLE_CLASS,
} from '@/app/settings/theme';

interface MembersPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 커뮤니티 멤버 관리 페이지 (/c/[slug]/members)
 * ADMIN 이상 권한 필요
 */
export default function MembersPage({ params }: MembersPageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuth();

  // 필터 상태
  const [roleFilter, setRoleFilter] = useState<CommunityRoleType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'members' | 'bans'>('members');

  // 다이얼로그 상태
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    userId: string;
    username: string;
    currentRole: CommunityRoleType;
    newRole: CommunityRoleType;
  } | null>(null);
  const [banTarget, setBanTarget] = useState<{
    userId: string;
    username: string;
  } | null>(null);
  const [banReason, setBanReason] = useState('');

  // 커뮤니티 정보
  const { data: community, isLoading: isCommunityLoading } = useCommunity(slug);

  // 멤버 목록
  const {
    data: membersData,
    fetchNextPage: fetchNextMembers,
    hasNextPage: hasMoreMembers,
    isFetchingNextPage: isFetchingMoreMembers,
    isLoading: isMembersLoading,
  } = useCommunityMembers(slug, {
    role: roleFilter === 'all' ? undefined : roleFilter,
  });

  // 차단 목록
  const {
    data: bansData,
    fetchNextPage: fetchNextBans,
    hasNextPage: hasMoreBans,
    isFetchingNextPage: isFetchingMoreBans,
    isLoading: isBansLoading,
  } = useCommunityBans(slug);

  // Mutations
  const updateRoleMutation = useUpdateMemberRole(slug);
  const banMutation = useBanMember(slug);
  const unbanMutation = useUnbanMember(slug);

  // 권한 체크
  const userRole = community?.userMembership?.role;
  const isUserOwner = isOwner(userRole);
  const isUserAdmin = isAdminOrAbove(userRole);
  const hasPermission = isAdminOrAbove(userRole);

  // 멤버 목록 평탄화 및 검색 필터링 (중복 제거 포함)
  const allMembers = useMemo(() => {
    if (!membersData?.pages) return [];
    const members = membersData.pages.flatMap((page) => page.items || []);
    // ID 기준 중복 제거 (페이지네이션 시 중복 방지)
    const uniqueMembers = members.filter(
      (member, index, self) => index === self.findIndex((m) => m.id === member.id)
    );
    if (!searchQuery.trim()) return uniqueMembers;
    const query = searchQuery.toLowerCase();
    return uniqueMembers.filter((m) =>
      m.user?.username?.toLowerCase().includes(query)
    );
  }, [membersData?.pages, searchQuery]);

  // 차단 목록 평탄화 (중복 제거 포함)
  const allBans = useMemo(() => {
    if (!bansData?.pages) return [];
    const bans = bansData.pages.flatMap((page) => page.items || []);
    // ID 기준 중복 제거
    return bans.filter(
      (ban, index, self) => index === self.findIndex((b) => b.id === ban.id)
    );
  }, [bansData?.pages]);

  // 역할 변경 핸들러
  const handleRoleChange = useCallback(
    async (userId: string, username: string, currentRole: CommunityRoleType, newRole: CommunityRoleType) => {
      setRoleChangeTarget({ userId, username, currentRole, newRole });
    },
    []
  );

  const confirmRoleChange = useCallback(async () => {
    if (!roleChangeTarget) return;
    try {
      await updateRoleMutation.mutateAsync({
        userId: roleChangeTarget.userId,
        role: roleChangeTarget.newRole,
      });
    } catch (error) {
      // 에러 처리
    }
    setRoleChangeTarget(null);
  }, [roleChangeTarget, updateRoleMutation]);

  // 차단 핸들러
  const handleBan = useCallback((userId: string, username: string) => {
    setBanTarget({ userId, username });
    setBanReason('');
  }, []);

  const confirmBan = useCallback(async () => {
    if (!banTarget) return;
    try {
      await banMutation.mutateAsync({
        userId: banTarget.userId,
        dto: { reason: banReason || undefined },
      });
    } catch (error) {
      // 에러 처리
    }
    setBanTarget(null);
    setBanReason('');
  }, [banTarget, banReason, banMutation]);

  // 차단 해제 핸들러
  const handleUnban = useCallback(
    async (userId: string) => {
      try {
        await unbanMutation.mutateAsync(userId);
      } catch (error) {
        // 에러 처리
      }
    },
    [unbanMutation]
  );

  // 역할 아이콘
  const getRoleIcon = (role: CommunityRoleType) => {
    switch (role) {
      case CommunityRole.OWNER:
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case CommunityRole.ADMIN:
        return <Shield className="w-4 h-4 text-blue-500" />;
      case CommunityRole.MODERATOR:
        return <UserCog className="w-4 h-4 text-green-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-400" />;
    }
  };

  // 역할 변경 가능 여부
  const canChangeRole = (targetRole: CommunityRoleType) => {
    // OWNER만 역할 변경 가능
    if (!isUserOwner) return false;
    // OWNER는 변경 불가
    if (targetRole === CommunityRole.OWNER) return false;
    return true;
  };

  // 로딩 상태
  if (isCommunityLoading) {
    return (
      <CommunityAdminLayout slug={slug}>
        <div className="animate-pulse space-y-6">
          <div className="h-64 bg-gray-200 dark:bg-white/10 rounded-xl" />
        </div>
      </CommunityAdminLayout>
    );
  }

  // 권한 없음 (ADMIN 이상만 접근 가능)
  if (!hasPermission) {
    return (
      <CommunityAdminLayout slug={slug}>
        <div className="text-center py-12">
          <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            권한이 없습니다
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            멤버 관리는 관리자 이상의 권한이 필요합니다.
          </p>
        </div>
      </CommunityAdminLayout>
    );
  }

  return (
    <CommunityAdminLayout slug={slug}>
      <div className="space-y-6">
        <section className={`${SETTINGS_CARD_CLASS} p-4 sm:p-6 space-y-6`}>
          <div className="space-y-1">
            <h2 className={SETTINGS_SECTION_TITLE_CLASS}>멤버 관리</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">멤버 역할을 관리하고 차단 상태를 확인하세요.</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-colors border',
                activeTab === 'members'
                  ? 'bg-[#6D79FF] text-white border-[#6D79FF] shadow-lg shadow-[#6D79FF]/25'
                  : 'bg-white text-gray-600 border-gray-200 dark:bg-[#1F2229] dark:text-gray-300 dark:border-[#2F3440] hover:border-gray-300 dark:hover:border-[#3A414F]'
              )}
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              멤버 ({membersData?.pages[0]?.total || 0})
            </button>
            <button
              onClick={() => setActiveTab('bans')}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-sm transition-colors border',
                activeTab === 'bans'
                  ? 'bg-[#6D79FF] text-white border-[#6D79FF] shadow-lg shadow-[#6D79FF]/25'
                  : 'bg-white text-gray-600 border-gray-200 dark:bg-[#1F2229] dark:text-gray-300 dark:border-[#2F3440] hover:border-gray-300 dark:hover:border-[#3A414F]'
              )}
            >
              <Ban className="w-4 h-4 inline-block mr-2" />
              차단됨 ({bansData?.pages[0]?.total || 0})
            </button>
          </div>

          {activeTab === 'members' ? (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
              {/* 검색 */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="멤버 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`${SETTINGS_INPUT_CLASS} pl-10`}
                />
              </div>

              {/* 역할 필터 */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={`${SETTINGS_SUBTLE_BUTTON_CLASS} min-w-[140px] justify-between flex items-center`}>
                    {roleFilter === 'all' ? '모든 역할' : (
                      <>
                        {getRoleIcon(roleFilter)}
                        <span className="ml-2">
                          {roleFilter === CommunityRole.OWNER && '오너'}
                          {roleFilter === CommunityRole.ADMIN && '관리자'}
                          {roleFilter === CommunityRole.MODERATOR && '매니저'}
                          {roleFilter === CommunityRole.MEMBER && '멤버'}
                        </span>
                      </>
                    )}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setRoleFilter('all')}>
                    모든 역할
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setRoleFilter(CommunityRole.OWNER)}>
                    <Crown className="w-4 h-4 mr-2 text-yellow-500" />
                    오너
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter(CommunityRole.ADMIN)}>
                    <Shield className="w-4 h-4 mr-2 text-blue-500" />
                    관리자
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter(CommunityRole.MODERATOR)}>
                    <UserCog className="w-4 h-4 mr-2 text-green-500" />
                    매니저
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter(CommunityRole.MEMBER)}>
                    <Users className="w-4 h-4 mr-2 text-gray-400" />
                    멤버
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* 멤버 목록 */}
          <div className="rounded-2xl border border-gray-100 dark:border-[#2F3440] bg-white dark:bg-[#1F2229] shadow-sm overflow-hidden">
              {isMembersLoading ? (
                <div key="members-loading" className="p-8 text-center">
                  <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : allMembers.length === 0 ? (
                <div key="members-empty" className="p-8 text-center text-gray-500 dark:text-gray-400">
                  {searchQuery ? '검색 결과가 없습니다.' : '멤버가 없습니다.'}
                </div>
              ) : (
                <div key="members-list" className="divide-y divide-gray-100 dark:divide-[#2F3440]">
                  {allMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#252b37]"
                    >
                      <div className="flex items-center gap-3">
                        <Link href={`/${member.user?.username}`}>
                          <UserAvatar
                            profileImage={member.user?.profileImage}
                            username={member.user?.username || ''}
                            size="md"
                          />
                        </Link>
                        <div>
                          <Link
                            href={`/${member.user?.username}`}
                            className="font-medium text-gray-900 dark:text-gray-100 hover:underline"
                          >
                            {member.user?.username}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <MemberRoleBadge role={member.role} size="sm" />
                          </div>
                        </div>
                      </div>

                      {/* 액션 메뉴 */}
                      {canChangeRole(member.role) && member.user?.id !== user?.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-300 dark:hover:text-white"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* 역할 변경 */}
                            {member.role !== CommunityRole.ADMIN && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(
                                    member.user!.id,
                                    member.user!.username,
                                    member.role,
                                    CommunityRole.ADMIN
                                  )
                                }
                              >
                                <Shield className="w-4 h-4 mr-2 text-blue-500" />
                                관리자로 임명
                              </DropdownMenuItem>
                            )}
                            {member.role !== CommunityRole.MODERATOR && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(
                                    member.user!.id,
                                    member.user!.username,
                                    member.role,
                                    CommunityRole.MODERATOR
                                  )
                                }
                              >
                                <UserCog className="w-4 h-4 mr-2 text-green-500" />
                                매니저로 임명
                              </DropdownMenuItem>
                            )}
                            {member.role !== CommunityRole.MEMBER && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleRoleChange(
                                    member.user!.id,
                                    member.user!.username,
                                    member.role,
                                    CommunityRole.MEMBER
                                  )
                                }
                              >
                                <Users className="w-4 h-4 mr-2 text-gray-400" />
                                일반 멤버로 변경
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {/* 차단 */}
                            <DropdownMenuItem
                              onClick={() => handleBan(member.user!.id, member.user!.username)}
                              className="text-red-600 dark:text-red-400"
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              차단하기
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 더보기 */}
              {hasMoreMembers && (
                <div className="p-4 border-t border-gray-100 dark:border-[#2F3440]">
                  <button
                    type="button"
                    onClick={() => fetchNextMembers()}
                    disabled={isFetchingMoreMembers}
                    className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full justify-center`}
                  >
                    {isFetchingMoreMembers ? '불러오는 중...' : '더 보기'}
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* 차단 목록 */
          <div className="rounded-2xl border border-gray-100 dark:border-[#2F3440] bg-white dark:bg-[#1F2229] shadow-sm overflow-hidden">
            {isBansLoading ? (
              <div key="bans-loading" className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : allBans.length === 0 ? (
              <div key="bans-empty" className="p-8 text-center text-gray-500 dark:text-gray-400">
                차단된 멤버가 없습니다.
              </div>
            ) : (
              <div key="bans-list" className="divide-y divide-gray-100 dark:divide-[#2F3440]">
                {allBans.map((ban) => (
                  <div
                    key={ban.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-[#252b37]"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        profileImage={ban.user?.profileImage}
                        username={ban.user?.username || ''}
                        size="md"
                      />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {ban.user?.username}
                        </p>
                        {ban.reason && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            사유: {ban.reason}
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUnban(ban.userId)}
                      disabled={unbanMutation.isPending}
                      className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-auto gap-2`}
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      차단 해제
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 더보기 */}
            {hasMoreBans && (
              <div className="p-4 border-t border-gray-100 dark:border-[#2F3440]">
                <button
                  type="button"
                  onClick={() => fetchNextBans()}
                  disabled={isFetchingMoreBans}
                  className={`${SETTINGS_SUBTLE_BUTTON_CLASS} w-full justify-center`}
                >
                  {isFetchingMoreBans ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
          </div>
        )}
        </section>
      </div>

      {/* 역할 변경 다이얼로그 */}
      <AlertDialog open={!!roleChangeTarget} onOpenChange={() => setRoleChangeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 변경</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{roleChangeTarget?.username}</strong>님의 역할을{' '}
              <strong>
                {roleChangeTarget?.newRole === CommunityRole.ADMIN && '관리자'}
                {roleChangeTarget?.newRole === CommunityRole.MODERATOR && '매니저'}
                {roleChangeTarget?.newRole === CommunityRole.MEMBER && '일반 멤버'}
              </strong>
              로 변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRoleChange}>
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 차단 다이얼로그 */}
      <AlertDialog open={!!banTarget} onOpenChange={() => setBanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>멤버 차단</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{banTarget?.username}</strong>님을 차단하시겠습니까?
              <br />
              차단된 멤버는 커뮤니티에 접근할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              차단 사유 (선택)
            </label>
            <input
              type="text"
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="차단 사유를 입력하세요..."
              className={`${SETTINGS_INPUT_CLASS} mt-2`}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBan}
              className="bg-red-600 hover:bg-red-700"
            >
              차단
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CommunityAdminLayout>
  );
}
