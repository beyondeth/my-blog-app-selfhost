'use client';

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
  FiEdit3,
  FiBookOpen,
  FiShield,
  FiBell,
  FiHelpCircle,
  FiUsers,
  FiMessageSquare,
  FiCreditCard,
  FiTrendingUp,
  FiBookmark
} from 'react-icons/fi';
import { FEATURES } from '@/lib/features';

interface ProfileDropdownProps {
  user: User;
  onLogout: () => void;
  onWriteClick: (e: React.MouseEvent) => void;
}

export default function ProfileDropdown({
  user,
  onLogout,
  onWriteClick
}: ProfileDropdownProps) {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 px-3 py-2 text-sm text-foreground rounded-md hover:bg-accent hover:text-accent-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
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
        
        {/* Write Button */}
        <DropdownMenuItem
          onClick={onWriteClick}
          className="cursor-pointer"
        >
          <FiEdit3 className="mr-2 h-4 w-4" />
          <span>글쓰기</span>
        </DropdownMenuItem>

        {/* My Blog - user.blogSlug로 즉시 표시 */}
        {user.blogSlug && (
          <DropdownMenuItem
            onClick={() => handleNavigation(`/blog/${user.blogSlug}`)}
            className="cursor-pointer"
          >
            <FiBookOpen className="mr-2 h-4 w-4" />
            <span>내 블로그</span>
          </DropdownMenuItem>
        )}

        {/* Bookmarks - 북마크 메뉴 추가 */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/bookmarks')}
          className="cursor-pointer"
        >
          <FiBookmark className="mr-2 h-4 w-4" />
          <span>북마크</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* 구독 관련 메뉴 (Feature Flag) */}
        {FEATURES.SUBSCRIPTION && (
        <>
        {/* 구독 관리 */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/account/subscription')}
          className="cursor-pointer"
        >
          <FiCreditCard className="mr-2 h-4 w-4" />
          <span>구독 관리</span>
        </DropdownMenuItem>

        {/* 요금제 */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/pricing')}
          className="cursor-pointer"
        >
          <FiTrendingUp className="mr-2 h-4 w-4" />
          <span>요금제</span>
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
          <span>프로필 설정</span>
        </DropdownMenuItem>

        {/* Relationships */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/settings/relationships')}
          className="cursor-pointer"
        >
          <FiUsers className="mr-2 h-4 w-4" />
          <span>관계 설정</span>
        </DropdownMenuItem>

        {/* DM Management */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/settings/dm')}
          className="cursor-pointer"
        >
          <FiMessageSquare className="mr-2 h-4 w-4" />
          <span>DM 관리</span>
        </DropdownMenuItem>


        {/* Blog Settings */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/settings/blog')}
          className="cursor-pointer"
        >
          <FiSettings className="mr-2 h-4 w-4" />
          <span>블로그 설정</span>
        </DropdownMenuItem>

        {/* Security */}
        <DropdownMenuItem
          onClick={() => handleNavigation('/settings/security')}
          className="cursor-pointer"
        >
          <FiShield className="mr-2 h-4 w-4" />
          <span>보안</span>
        </DropdownMenuItem>

        {/* Notifications (Feature Flag) */}
        {FEATURES.NOTIFICATIONS && (
        <DropdownMenuItem
          onClick={() => handleNavigation('/settings/notifications')}
          className="cursor-pointer"
        >
          <FiBell className="mr-2 h-4 w-4" />
          <span>알림</span>
        </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Help Center */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/help-center')}
          className="cursor-pointer"
        >
          <FiHelpCircle className="mr-2 h-4 w-4" />
          <span>고객센터</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* Logout */}
        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <FiLogOut className="mr-2 h-4 w-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}