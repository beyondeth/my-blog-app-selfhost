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
  FiKey,
} from 'react-icons/fi';
import { ArrowLeft, BarChart3, CreditCard } from 'lucide-react';
import { FEATURES } from '@/lib/features';
import { canAccessSubscriptionUi } from '@/lib/subscription-access';
import { useAuth } from '@/providers/AuthProviderV2';
import { DESTRUCTIVE_ACTION_CLASS } from '@/constants/accessibility';
import { Button } from '@/components/ui/button';

// Feature Flag에 따라 동적으로 메뉴 구성
const getSettingsNav = (canManageBilling: boolean) => {
  const baseNav = [
    {
      title: 'Profile',
      href: '/settings',
      icon: FiUser,
    },
    {
      title: 'Relationships',
      href: '/settings/relationships',
      icon: FiUsers,
    },
    {
      title: 'Chat',
      href: '/settings/dm',
      icon: FiMessageCircle,
    },
    {
      title: 'Blog',
      href: '/settings/blog',
      icon: FiSettings,
    },
    {
      title: 'Analytics',
      href: '/settings/analytics',
      icon: BarChart3,
    },
    {
      title: 'Security',
      href: '/settings/security',
      icon: FiShield,
    },
    {
      title: 'API & integrations',
      href: '/settings/api-keys',
      icon: FiKey,
    },
  ];

  if (canManageBilling) {
    baseNav.splice(5, 0, {
      title: 'Billing',
      href: '/settings/billing',
      icon: CreditCard,
    });
  }

  // 알림 기능이 활성화된 경우에만 메뉴에 추가
  if (FEATURES.NOTIFICATIONS) {
    baseNav.push({
      title: 'Notifications',
      href: '/settings/notifications',
      icon: FiBell,
    });
  }

  return baseNav;
};

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
  const { logout, isAdmin } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(pathname);
  const settingsNav = getSettingsNav(canAccessSubscriptionUi(isAdmin));

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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-10 md:py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/')}
            className="h-10 w-10 rounded-full border border-gray-200 dark:border-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to home</span>
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-50">Settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">Manage your profile, blog, and account.</p>
          </div>
        </div>

        <div className="w-full space-y-2">
          <p className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400">Menu</p>
          <div className="rounded-2xl border border-gray-200 bg-[#FAFAFA] p-2 dark:border-[#2F3440] dark:bg-[#161B24]">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(132px,1fr))]">
              {settingsNav.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all ${
                      isActive
                        ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white dark:border-[#6D79FF] dark:bg-[#6D79FF] dark:text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-900 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-200 dark:hover:border-[#3A414F] dark:hover:text-white'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
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
