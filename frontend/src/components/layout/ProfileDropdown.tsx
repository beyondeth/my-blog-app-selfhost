'use client';

import { useEffect, useState } from 'react';
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
  FiUser,
  FiSettings,
  FiLogOut,
  FiChevronDown,
  FiBell,
  FiBookOpen,
  FiHelpCircle,
  FiCreditCard,
  FiTrendingUp,
  FiKey,
  FiFileText,
  FiBookmark
} from 'react-icons/fi';
import { FEATURES } from '@/lib/features';
import { canAccessSubscriptionUi } from '@/lib/subscription-access';
import { routes } from '@/lib/navigation';
import { useMyCommunities } from '@/hooks/community/useCommunities';

interface ProfileDropdownProps {
  user: User | null;
  onLogout: () => void;
}

export default function ProfileDropdown({
  user,
  onLogout
}: ProfileDropdownProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const { data: myCommunities } = useMyCommunities({ enabled: !!user && mounted });
  const canManageSubscription = canAccessSubscriptionUi(
    user?.role?.toLowerCase() === 'admin'
  );

  // 관리 중인 커뮤니티 필터링 (Owner or Moderator)
  const managedCommunities = myCommunities?.filter(community => 
    community.userMembership?.isMember && 
    ['owner', 'moderator'].includes(community.userMembership?.role || '')
  );

  if (!mounted) {
    return null;
  }

  if (!user) {
    return <div className="w-20 h-8 bg-muted rounded animate-pulse" />;
  }

  return (
    <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Account menu"
            className="flex items-center space-x-2 px-3 py-2 text-sm text-foreground rounded-md border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300 dark:focus-visible:ring-gray-600"
          >
            <div className="flex items-center space-x-2">
              <Avatar
                src={user.profileImage}
                alt={user.username}
                fallback={user.username}
                size="sm"
              />
              <span className="font-medium">{user.username}</span>
              <FiChevronDown className="w-4 h-4" />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-gray-500 dark:text-gray-400">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {/* 구독 관련 메뉴 (Feature Flag) */}
        {canManageSubscription && (
        <>
        {/* 구독 관리 */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/account/subscription')}
          className="cursor-pointer"
        >
          <FiCreditCard className="mr-2 h-4 w-4" />
          <span>Manage subscription</span>
        </DropdownMenuItem>

        {/* 요금제 */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/pricing')}
          className="cursor-pointer"
        >
          <FiTrendingUp className="mr-2 h-4 w-4" />
          <span>Pricing</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        </>
        )}

        {/* Settings */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/settings')}
          className="cursor-pointer"
        >
          <FiUser className="mr-2 h-4 w-4" />
          <span>Profile settings</span>
        </DropdownMenuItem>

        {/* Blog Settings */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/settings/blog')}
          className="cursor-pointer"
        >
          <FiSettings className="mr-2 h-4 w-4" />
          <span>Blog settings</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation('/settings/api-keys')}
          className="cursor-pointer"
        >
          <FiKey className="mr-2 h-4 w-4" />
          <span>Auto-posting connection</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 내 초안 */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/drafts')}
          className="cursor-pointer"
        >
          <FiFileText className="mr-2 h-4 w-4" />
          <span>My drafts</span>
        </DropdownMenuItem>

        {/* 북마크 */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/bookmarks')}
          className="cursor-pointer"
        >
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

        {/* Customer Support */}
        <DropdownMenuItem
          onClick={() => handleNavigation(routes.docs())}
          className="cursor-pointer"
        >
          <FiBookOpen className="mr-2 h-4 w-4" />
          <span>Guides</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => handleNavigation('/support')}
          className="cursor-pointer"
        >
          <FiHelpCircle className="mr-2 h-4 w-4" />
          <span>Support</span>
        </DropdownMenuItem>

        {/* Notifications (Feature Flag) */}
        {FEATURES.NOTIFICATIONS && (
        <DropdownMenuItem
          onClick={() => handleNavigation('/settings/notifications')}
          className="cursor-pointer"
        >
          <FiBell className="mr-2 h-4 w-4" />
          <span>Notifications</span>
        </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Logout */}
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
