'use client';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FiUser,
  FiSettings,
  FiShield,
  FiBell,
  FiUsers,
  FiMessageCircle,
  FiLogOut,
  FiKey,
} from 'react-icons/fi';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import { useAuth } from '@/providers/AuthProviderV2';
import { DESTRUCTIVE_ACTION_CLASS } from '@/constants/accessibility';
import { Button } from '@/components/ui/button';

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
      title: '블로그 분석',
      href: '/settings/analytics',
      icon: BarChart3,
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

/**
 * 설정 레이아웃 메인 컴포넌트
 * useSearchParams를 사용하므로 Suspense로 감싸야 함
 */
function SettingsLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(pathname);

  useEffect(() => {
    setActiveTab(pathname);
  }, [pathname]);

  useEffect(() => {
    const openMenu = searchParams.get('openMenu');
    if (openMenu === 'logout') {
      logout('/');
    }
  }, [logout, searchParams]);

  return (
    <div className="min-h-screen bg-background dark:bg-[#0E141B]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="h-10 w-10 rounded-full border border-gray-200 dark:border-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">홈으로 돌아가기</span>
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-50">설정</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">프로필, 블로그 등을 관리하세요</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex w-full items-center overflow-x-auto rounded-3xl border border-gray-100 bg-gray-200 shadow-[0_8px_24px_rgba(15,23,42,0.05)] dark:bg-gray-800 dark:border-gray-700">
            <div className="flex">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-colors border-b-2 ${
                      isActive
                        ? 'text-gray-900 dark:text-gray-50 border-[#5850ec] dark:border-[#818cf8]'
                        : 'text-gray-600 dark:text-gray-200 border-transparent hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                );
              })}
            </div>
            <button
              onClick={() => logout('/')}
              className="ml-auto flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-[#1f2330] transition-colors"
            >
              <FiLogOut className="h-4 w-4" />
              로그아웃
            </button>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-gray-500">로딩 중...</div>}>
          {children}
        </Suspense>
      </div>
    </div>
  );
}

/**
 * 설정 레이아웃 (Suspense 래퍼)
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </Suspense>
  );
}
