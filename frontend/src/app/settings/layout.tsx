'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiUser, FiKey, FiBook, FiShield, FiBell, FiUsers } from 'react-icons/fi';

const settingsNav = [
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
    title: 'API 키',
    href: '/settings/api-keys',
    icon: FiKey,
  },
  {
    title: '블로그 설정',
    href: '/settings/blog',
    icon: FiBook,
  },
  {
    title: '보안',
    href: '/settings/security',
    icon: FiShield,
  },
  {
    title: '알림',
    href: '/settings/notifications',
    icon: FiBell,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-600 mt-1">
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
                      ? 'bg-blue-50 text-blue-700' 
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }
                  `}
                >
                  <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  {item.title}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}