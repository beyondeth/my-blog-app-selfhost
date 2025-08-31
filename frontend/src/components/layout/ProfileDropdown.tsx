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
  FiKey, 
  FiLogOut, 
  FiChevronDown,
  FiEdit3,
  FiBookOpen,
  FiBarChart2,
  FiShield,
  FiBell,
  FiHelpCircle,
  FiUsers
} from 'react-icons/fi';

interface ProfileDropdownProps {
  user: User;
  blog: any;
  blogLoading: boolean;
  onLogout: () => void;
  onWriteClick: (e: React.MouseEvent) => void;
  isCheckingBlog: boolean;
}

export default function ProfileDropdown({ 
  user, 
  blog, 
  blogLoading, 
  onLogout, 
  onWriteClick,
  isCheckingBlog 
}: ProfileDropdownProps) {
  const router = useRouter();

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 px-3 py-2 text-sm rounded-md hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
          <div className="flex items-center space-x-2">
            <Avatar 
              src={user.profileImage} 
              alt={user.username}
              fallback={user.username}
              size="sm"
            />
            <span className="text-gray-700 font-medium">{user.username}</span>
            <FiChevronDown className="w-4 h-4 text-gray-500" />
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.username}</p>
            <p className="text-xs leading-none text-gray-500">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* Write Button */}
        <DropdownMenuItem 
          onClick={onWriteClick}
          disabled={isCheckingBlog}
          className="cursor-pointer"
        >
          <FiEdit3 className="mr-2 h-4 w-4" />
          <span>{isCheckingBlog ? '확인 중...' : '글쓰기'}</span>
        </DropdownMenuItem>

        {/* My Blog */}
        {!blogLoading && blog && (
          <DropdownMenuItem 
            onClick={() => handleNavigation(`/blog/${blog.slug}`)}
            className="cursor-pointer"
          >
            <FiBookOpen className="mr-2 h-4 w-4" />
            <span>내 블로그</span>
          </DropdownMenuItem>
        )}

        {/* Analytics */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/analytics')}
          className="cursor-pointer"
        >
          <FiBarChart2 className="mr-2 h-4 w-4" />
          <span>분석</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

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

        {/* API Keys */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/settings/api-keys')}
          className="cursor-pointer"
        >
          <FiKey className="mr-2 h-4 w-4" />
          <span>API 키</span>
        </DropdownMenuItem>

        {/* Security */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/settings/security')}
          className="cursor-pointer"
        >
          <FiShield className="mr-2 h-4 w-4" />
          <span>보안</span>
        </DropdownMenuItem>

        {/* Notifications */}
        <DropdownMenuItem 
          onClick={() => handleNavigation('/settings/notifications')}
          className="cursor-pointer"
        >
          <FiBell className="mr-2 h-4 w-4" />
          <span>알림</span>
        </DropdownMenuItem>

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
          className="cursor-pointer text-red-600 focus:text-red-600"
        >
          <FiLogOut className="mr-2 h-4 w-4" />
          <span>로그아웃</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}