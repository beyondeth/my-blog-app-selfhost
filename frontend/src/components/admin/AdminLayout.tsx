'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  Flag,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
  Image,
  Bug,
  Database,
  AlertTriangle,
  Key,
  UserX,
  Music,
  ShieldAlert,
  Trophy,
  Star,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/providers/AuthProviderV2';
import { toast } from 'sonner';
import { t } from '@/constants/adminTranslations';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';

interface NavigationItem {
  name: string;
  href: string;
  icon: any;
  adminOnly?: boolean;
  badge?: string;
}

const navigation: NavigationItem[] = [
  { name: t.navigation.dashboard, href: '/admin', icon: LayoutDashboard },
  { name: t.navigation.users, href: '/admin/users', icon: Users },
  { name: '삭제된 사용자', href: '/admin/users/deleted', icon: UserX, adminOnly: true },
  { name: t.navigation.posts, href: '/admin/posts', icon: FileText },
  { name: '에디터 픽', href: '/admin/editor-picks', icon: Star, adminOnly: true },
  { name: '이미지 관리', href: '/admin/images', icon: Image },
  { name: '음악 관리', href: '/admin/music', icon: Music, adminOnly: true },
  { name: 'MCP 대시보드', href: '/admin/mcp', icon: Key, adminOnly: true, badge: 'New' },
  { name: '마켓플레이스', href: '/admin/marketplace', icon: ShoppingBag, adminOnly: true },
  { name: '평판 시스템', href: '/admin/reputation', icon: Trophy, adminOnly: true },
  { name: '보안 모니터링', href: '/admin/monitoring', icon: AlertTriangle, adminOnly: true },
  { name: 'Redis 모니터링', href: '/admin/redis', icon: Database, adminOnly: true },
  { name: '커뮤니티 복구', href: '/admin/communities', icon: ShieldAlert, adminOnly: true },
  { name: '유저 모더레이션', href: '/admin/moderation/logs', icon: Flag, adminOnly: true },
  { name: '고객의 소리', href: '/admin/feedback', icon: Flag },
  { name: t.navigation.reports, href: '/admin/reports', icon: Flag },
  { name: '디버그 콘솔', href: '/admin/debug', icon: Bug, adminOnly: true },
  { name: t.navigation.settings, href: '/admin/settings', icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading: authLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('AdminLayout - Auth state:', { authLoading, user, role: user?.role });
    
    // Auth가 로딩 중이면 대기
    if (authLoading) {
      console.log('AdminLayout - Still loading auth...');
      return;
    }

    // 권한 체크
    if (!user) {
      console.log('AdminLayout - No user, redirecting to login');
      toast.error('로그인이 필요합니다');
      router.push('/login?redirect=/admin');
      return;
    }

    console.log('AdminLayout - User role:', user.role);
    if (user.role !== 'admin' && user.role !== 'moderator') {
      console.log('AdminLayout - Insufficient permissions, redirecting to home');
      toast.error('관리자 권한이 필요합니다');
      router.push('/');
      return;
    }

    console.log('AdminLayout - Access granted!');
    setIsInitialized(true);
  }, [user, router, authLoading]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/');
    } catch (error) {
      toast.error('로그아웃 실패');
    }
  };

  if (authLoading || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#181818]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white dark:bg-[#1F1F1F] border-r border-gray-200 dark:border-[#2A2A2A] lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } transition-transform duration-300 ease-in-out lg:translate-x-0`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between px-6 border-b border-gray-200 dark:border-[#2A2A2A]">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Shield className="h-8 w-8 text-indigo-600 dark:text-indigo-400 fill-indigo-200 dark:fill-indigo-900" />
              <div className="absolute inset-0 h-8 w-8 animate-shimmer">
                <Shield className="h-8 w-8 text-indigo-500 dark:text-indigo-500 fill-transparent" />
              </div>
            </div>
            <span className="ml-2 text-xl font-semibold text-gray-900 dark:text-[#FDFDFD]">{t.navigation.adminPanel}</span>
            {/* 테마 토글 버튼 */}
            <ThemeSwitch />
          </div>
          <button
            type="button"
            className="lg:hidden text-gray-700 dark:text-gray-300"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-4 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            // Moderator는 Settings와 Debug 접근 불가
            if ((item.name === t.navigation.settings || item.adminOnly) && user.role === 'moderator') {
              return null;
            }

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-[#2D2D2D] text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#FDFDFD] hover:bg-gray-50 dark:hover:bg-[#2D2D2D]'
                }`}
              >
                <div className="flex items-center">
                  <Icon
                    className={`mr-3 h-5 w-5 ${
                      isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400'
                    }`}
                  />
                  {item.name}
                </div>
                {item.badge && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-200 dark:border-[#2A2A2A] p-4">
          <div className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="h-8 w-8 rounded-full"
              src={user.profileImage || `https://ui-avatars.com/api/?name=${user.username}`}
              alt={user.username}
            />
            <div className="ml-3 flex-1">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user.username}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
            </div>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="mt-3 w-full justify-start text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-[#FDFDFD] hover:bg-gray-100 dark:hover:bg-[#2D2D2D]"
          >
            <LogOut className="mr-2 h-4 w-4" />
            {t.navigation.logout}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#1F1F1F] px-4 shadow-sm lg:hidden">
          <button
            type="button"
            className="text-gray-700 dark:text-gray-300"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex flex-1 items-center justify-between">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-[#FDFDFD]">{t.navigation.adminPanel}</h1>
            <div className="relative">
              <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400 fill-indigo-200 dark:fill-indigo-900" />
              <div className="absolute inset-0 h-6 w-6 animate-shimmer">
                <Shield className="h-6 w-6 text-indigo-500 dark:text-indigo-500 fill-transparent" />
              </div>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
