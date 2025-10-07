'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiSettings, FiShield, FiBell, FiUsers, FiMessageSquare, FiLogOut } from 'react-icons/fi';
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
      title: 'DM 관리',
      href: '/settings/dm',
      icon: FiMessageSquare,
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
  const { logout } = useAuth();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          프로필, 보안, 알림 등을 관리하세요
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64">
          <nav className="space-y-1">
            {settingsNav.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors
                    ${isActive
                      ? 'bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-gray-100'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                    }
                  `}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`} />
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