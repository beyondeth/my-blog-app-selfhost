'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { User } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar } from '@/components/ui/avatar';
import {
  FiLogOut,
  FiSettings,
  FiUser,
  FiCreditCard,
  FiTrendingUp,
  FiBookOpen,
  FiFileText,
  FiBookmark,
  FiHelpCircle,
  FiKey,
} from 'react-icons/fi';
import { canAccessSubscriptionUi } from '@/lib/subscription-access';
import { useMyCommunities } from '@/hooks/community/useCommunities';
import { routes } from '@/lib/navigation';

interface MobileProfileDropdownProps {
  user: User;
  onLogout: () => void;
}

/**
 * 모바일 전용 심플한 프로필 드롭다운
 * 사용자 정보, 설정 바로가기, 로그아웃 제공
 */
export default function MobileProfileDropdown({
  user,
  onLogout
}: MobileProfileDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // 설정 버튼 클릭 핸들러: 드롭다운 닫고 페이지 이동
  const handleNavigation = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const { data: myCommunities } = useMyCommunities({ enabled: !!user });
  const canManageSubscription = canAccessSubscriptionUi(
    user?.role?.toLowerCase() === 'admin'
  );

  // 관리 중인 커뮤니티 필터링 (Owner or Moderator)
  const managedCommunities = myCommunities?.filter(community => 
    community.userMembership?.isMember && 
    ['owner', 'moderator'].includes(community.userMembership?.role || '')
  );

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
          aria-label="Profile menu"
        >
          <Avatar
            src={user.profileImage}
            alt={user.username}
            fallback={user.username}
            size="sm"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">{user.username}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* Feature Flag: Subscription */}
        {canManageSubscription && (
          <>
            <DropdownMenuItem onClick={() => handleNavigation('/account/subscription')} className="cursor-pointer">
              <FiCreditCard className="mr-2 h-4 w-4" />
              <span>Manage subscription</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleNavigation('/pricing')} className="cursor-pointer">
              <FiTrendingUp className="mr-2 h-4 w-4" />
              <span>Pricing</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Basic Settings */}
        <DropdownMenuItem onClick={() => handleNavigation('/settings')} className="cursor-pointer">
          <FiUser className="mr-2 h-4 w-4" />
          <span>Profile settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation('/settings/blog')} className="cursor-pointer">
          <FiSettings className="mr-2 h-4 w-4" />
          <span>Blog settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation('/settings/api-keys')} className="cursor-pointer">
          <FiKey className="mr-2 h-4 w-4" />
          <span>Auto-posting connection</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Content Management */}
        <DropdownMenuItem onClick={() => handleNavigation('/drafts')} className="cursor-pointer">
          <FiFileText className="mr-2 h-4 w-4" />
          <span>My drafts</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation('/bookmarks')} className="cursor-pointer">
          <FiBookmark className="mr-2 h-4 w-4" />
          <span>Bookmarks</span>
        </DropdownMenuItem>

        {/* Managed Communities */}
        {managedCommunities && managedCommunities.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1.5">
              Manage communities
            </DropdownMenuLabel>
            {managedCommunities.map((community) => (
              <DropdownMenuItem
                key={community.id}
                onClick={() => handleNavigation(`/c/${community.slug}/settings`)}
                className="cursor-pointer"
              >
                <FiSettings className="mr-2 h-4 w-4" />
                <span className="truncate">{community.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Support */}
        <DropdownMenuItem onClick={() => handleNavigation(routes.docs())} className="cursor-pointer">
          <FiBookOpen className="mr-2 h-4 w-4" />
          <span>Guides</span>
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => handleNavigation('/support')} className="cursor-pointer">
          <FiHelpCircle className="mr-2 h-4 w-4" />
          <span>Support</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <FiLogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
