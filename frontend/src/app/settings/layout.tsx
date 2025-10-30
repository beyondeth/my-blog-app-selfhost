'use client';

import { useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiSettings, FiShield, FiBell, FiUsers, FiMessageCircle, FiLogOut, FiKey, FiX } from 'react-icons/fi';
import { FEATURES } from '@/lib/features';
import { useAuth } from '@/providers/AuthProviderV2';

// Feature Flag에 따라 동적으로 메뉴 구성
const getSettingsNav = () => {
  const baseNav = [
    {
      title: '프로필',
      href: '/settings',
      icon: FiUser,
    },
    {
      title: '관계 설정',
      href: '/settings/relationships',
      icon: FiUsers,
    },
    {
      title: '채팅 관리',
      href: '/settings/dm',
      icon: FiMessageCircle,
    },
    {
      title: '블로그 설정',
      href: '/settings/blog',
      icon: FiSettings,
    },
    {
      title: '보안',
      href: '/settings/security',
      icon: FiShield,
    },
    {
      title: 'API Keys',
      href: '/settings/api-keys',
      icon: FiKey,
    },
  ];

  // 알림 기능이 활성화된 경우에만 메뉴에 추가
  if (FEATURES.NOTIFICATIONS) {
    baseNav.push({
      title: '알림',
      href: '/settings/notifications',
      icon: FiBell,
    });
  }

  return baseNav;
};

const settingsNav = getSettingsNav();

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // URL 쿼리 파라미터로 모바일 메뉴 자동 열기
  useEffect(() => {
    const openMenu = searchParams.get('openMenu');
    if (openMenu === 'true') {
      setIsMobileMenuOpen(true);
    }
  }, [searchParams]);

  // 메뉴 항목 클릭 시 모바일 메뉴 자동 닫기
  const handleMenuItemClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-8">
      <div className="mb-6 sm:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            프로필, 블로그 등을 관리하세요
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-8">
        {/* PC Sidebar Navigation - 데스크톱에서만 표시 */}
        <aside className="hidden md:block w-48">
          <nav className="space-y-1">
            {settingsNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                    }
                  `}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-gray-700 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`} />
                  {item.title}
                </Link>
              );
            })}

            {/* 로그아웃 버튼 */}
            <button
              onClick={() => logout('/')}
              className="flex items-center w-full px-4 py-2 text-sm font-medium rounded-md transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300"
            >
              <FiLogOut className="mr-3 h-5 w-5 text-red-500 dark:text-red-400" />
              로그아웃
            </button>
          </nav>
        </aside>

        {/* 모바일 드로어 메뉴 - 모바일에서만 표시 */}
        <>
          {/* 오버레이 */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
              onClick={handleMenuItemClick}
              aria-hidden="true"
            />
          )}

          {/* 드로어 메뉴 */}
          <aside
            className={`
              fixed top-0 left-0 bottom-0 w-64 bg-white dark:bg-gray-800 z-50 md:hidden
              transform transition-transform duration-300 ease-in-out
              ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
              overflow-y-auto
            `}
          >
            {/* 드로어 헤더 */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">설정 메뉴</h2>
              <button
                onClick={handleMenuItemClick}
                className="p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label="메뉴 닫기"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* 드로어 네비게이션 */}
            <nav className="p-4 space-y-1">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleMenuItemClick}
                    className={`
                      flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors
                      min-h-[44px]
                      ${isActive
                        ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }
                    `}
                  >
                    <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-gray-700 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`} />
                    {item.title}
                  </Link>
                );
              })}

              {/* 모바일 로그아웃 버튼 */}
              <button
                onClick={() => {
                  handleMenuItemClick();
                  logout('/');
                }}
                className="flex items-center w-full px-3 py-3 text-sm font-medium rounded-md transition-colors text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-700 dark:hover:text-red-300 min-h-[44px]"
              >
                <FiLogOut className="mr-3 h-5 w-5 text-red-500 dark:text-red-400" />
                로그아웃
              </button>
            </nav>
          </aside>
        </>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}