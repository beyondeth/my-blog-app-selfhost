'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Settings, Users, Shield, ShieldAlert, LayoutPanelLeft, ArrowLeft, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCommunity } from '@/hooks/community';
import { useAuth } from '@/providers/AuthProviderV2';
import { isModeratorOrAbove, isAdminOrAbove } from '@/types/community';
import { SETTINGS_PAGE_WRAPPER } from '@/app/settings/theme';

interface CommunityAdminLayoutProps {
  slug: string;
  children: React.ReactNode;
}

/**
 * 커뮤니티 관리 페이지 공통 레이아웃
 * 좌측 사이드바 네비게이션 + 우측 컨텐츠 영역
 */
export default function CommunityAdminLayout({
  slug,
  children,
}: CommunityAdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  // 커뮤니티 정보 및 사용자 권한 조회
  const { data: community, isLoading } = useCommunity(slug);

  const userRole = community?.userMembership?.role;
  const canManage = isModeratorOrAbove(userRole);
  const canManageMembers = isAdminOrAbove(userRole);

  // 메뉴 항목 정의
  const menuItems = [
    {
      href: `/c/${slug}/settings`,
      label: 'General',
      icon: Settings,
      show: canManage,
    },
    {
      href: `/c/${slug}/members`,
      label: 'Members',
      icon: Users,
      show: canManageMembers, // ADMIN 이상만
    },
    {
      href: `/c/${slug}/settings/mod-tools`,
      label: 'Safety & lock',
      icon: ShieldAlert,
      show: canManage,
    },
    {
      href: `/c/${slug}/settings/widgets`,
      label: 'Widgets',
      icon: LayoutPanelLeft,
      show: canManage,
    },
    {
      href: `/c/${slug}/settings/analytics`,
      label: 'Analytics',
      icon: BarChart3,
      show: canManage,
    },
  ];

  // 현재 활성 메뉴 확인
  const isActive = (href: string) => pathname === href;

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#181818]">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 bg-gray-200 dark:bg-white/10 rounded" />
            <div className="h-64 bg-gray-200 dark:bg-white/10 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // 권한 없음
  if (!canManage) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#181818] flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Access denied
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Community management requires moderator access or higher.
          </p>
          <Button onClick={() => router.push(`/c/${slug}`)}>
            Back to community
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={SETTINGS_PAGE_WRAPPER}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/c/${slug}`)}
            className="h-10 w-10 rounded-full border border-gray-200 dark:border-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to community</span>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">Community settings</h1>
            <p className="text-sm text-gray-500 dark:text-gray-300">Manage c/{slug}</p>
          </div>
        </div>

        <div className="w-full space-y-2">
          <p className="px-1 text-xs font-medium text-gray-500 dark:text-gray-400">Management menu</p>
          <div className="rounded-2xl border border-gray-200 bg-[#FAFAFA] p-2 dark:border-[#2F3440] dark:bg-[#161B24]">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(148px,1fr))]">
              {menuItems
                .filter((item) => item.show)
                .map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center text-sm font-semibold transition-all ${
                        active
                          ? 'border-[#0D0D0D] bg-[#0D0D0D] text-white dark:border-[#6D79FF] dark:bg-[#6D79FF] dark:text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:text-gray-900 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-200 dark:hover:border-[#3A414F] dark:hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              <button
                type="button"
                onClick={() => router.push(`/c/${slug}`)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-center text-sm font-semibold text-gray-700 transition-all hover:border-gray-300 hover:text-gray-900 dark:border-[#2F3440] dark:bg-[#1F2229] dark:text-gray-200 dark:hover:border-[#3A414F] dark:hover:text-white"
              >
                Go to community
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
}
