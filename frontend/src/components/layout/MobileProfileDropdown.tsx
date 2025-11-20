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
import { FiLogOut, FiSettings } from 'react-icons/fi';

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
  const handleSettingsClick = () => {
    setOpen(false);
    router.push('/settings?openMenu=true');
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
          aria-label="프로필 메뉴"
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
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col space-y-1 flex-1 min-w-0">
              <p className="text-sm font-medium leading-none truncate">{user.username}</p>
              <p className="text-xs leading-none text-muted-foreground truncate">{user.email}</p>
            </div>
            <button
              onClick={handleSettingsClick}
              className="p-1 hover:bg-accent rounded-md transition-colors flex-shrink-0"
              aria-label="설정"
            >
              <FiSettings className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
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
