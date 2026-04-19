'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { WriteIcon } from '@/components/icons/WriteIcon';
import { NotificationBellIcon } from '@/components/icons/NotificationBellIcon';
import { MyBlogIcon } from '@/components/icons/MyBlogIcon';
import { BookmarkIcon } from '@/components/icons/BookmarkIcon';
import { SettingsIcon } from '@/components/icons/SettingsIcon';
import { MessageCircle, Users } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import { FEATURES } from '@/lib/features';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useDMModal } from '@/hooks/useDMModal';
import { useUserBlogV2, invalidateUserBlog } from '@/hooks/useUserBlogV2';
import { useQueryClient } from '@tanstack/react-query';
import { stripLocalePrefix } from '@/lib/i18n/config';
import { useLocaleContext } from '@/providers/LocaleProvider';

/**
 * 왼쪽 고정 사이드바 컴포넌트
 * 유튜브 스타일의 네비게이션 제공
 * - 홈: 메인 페이지로 이동
 * - 내 블로그: 내 블로그로 이동 (로그인 사용자만)
 * - 글쓰기: 새 포스트 작성 (로그인 사용자만)
 * - 알림: 알림 확인 (로그인 사용자만, Feature Flag로 활성화)
 *
 * SSR 하이드레이션 불일치 방지를 위해 클라이언트에서만 렌더링
 */
export default function LeftSidebar() {
  const { user } = useAuth();
  const { isOpen } = useSidebarStore();
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname || '/');
  const router = useRouter();
  const { openModal: openDMModal } = useDMModal();
  const { href } = useLocaleContext();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const queryClient = useQueryClient();
  const { blog, loading } = useUserBlogV2(); // 내 블로그 정보 가져오기
  const inactiveNavClass =
    'text-[#4B5563] dark:text-[#D5DEE8] hover:bg-[#E7ECF3] hover:text-[#1B2430] dark:hover:bg-[#1A232E] dark:hover:text-[#F5F7FA]';
  const isHomePath =
    normalizedPathname === '/' ||
    normalizedPathname === '/desktop' ||
    normalizedPathname === '/mobile';
  const copy = {
    home: 'Home',
    community: 'Community',
    myBlog: 'My blog',
    write: 'Write',
    bookmarks: 'Bookmarks',
    chat: 'Chat',
    settings: 'Settings',
    notifications: 'Notifications',
  };

  // 클라이언트에서만 렌더링 (SSR 하이드레이션 불일치 방지)
  useEffect(() => {
    setMounted(true);

    // 캐시 무효화하여 최신 데이터 확보
    if (user) {
      invalidateUserBlog(queryClient);
    }
  }, [user, queryClient]);

  // Debug logging (개발 환경에서만 출력)
  const logDebug = (...args: any[]) => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      console.log(...args);
    }
  };

  logDebug('[LeftSidebar] user:', user?.id, user?.email);
  logDebug('[LeftSidebar] blog:', blog);
  logDebug('[LeftSidebar] loading:', loading);

  // 읽지 않은 알림 수 조회 (로그인한 사용자 + Feature Flag 활성화 시에만)
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: async () => {
      if (!user) return 0;
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/notifications/unread`,
        {
          credentials: 'include',
        }
      );
      if (!response.ok) return 0;
      const data = await response.json();
      return data.count || 0;
    },
    enabled: !!user && FEATURES.NOTIFICATIONS, // Feature Flag와 로그인 상태 모두 확인
    refetchInterval: 30000, // 30초마다 새로고침
  });

  // Admin, 로그인, 회원가입 페이지에서는 사이드바를 숨김
  const isAdminPage = normalizedPathname.startsWith('/admin');
  const isAuthPage = normalizedPathname === '/login' || normalizedPathname === '/register';
  if (isAdminPage || isAuthPage || !user) {
    return null;
  }

  // SSR에서는 렌더링하지 않음 (테마 전환 시 border 깜빡임 방지)
  if (!mounted) {
    return null;
  }

  // 내 블로그 URL 결정 (alias 우선)
  const myBlogUrl = blog ? (blog.alias ? `/@${blog.alias}` : `/${blog.slug}`) : href('/settings/blog');

  // Debug logging for URL matching (개발 환경에서만 출력)
  logDebug('[LeftSidebar] myBlogUrl:', myBlogUrl);
  logDebug('[LeftSidebar] pathname:', pathname);
  logDebug('[LeftSidebar] pathname === myBlogUrl:', pathname === myBlogUrl);
  logDebug('[LeftSidebar] user && blog condition:', !!user && !!blog);

  return (
    <aside
      className={`hidden lg:block fixed left-0 top-40 h-[calc(100vh-10rem)] w-20 bg-white dark:bg-[#0E141B] border-r border-[#D9E0EA] dark:border-[#2A3645] z-40 ${
        isOpen ? 'translate-x-[23px]' : '-translate-x-full'
      }`}
      style={{
        border: 'none',
        transition: 'transform 300ms ease-in-out'
      }}
    >
      <nav className="flex flex-col items-center py-6 space-y-6">
        {/* 홈 버튼 */}
        <Link
          href={href('/')}
          prefetch={true}
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
            isHomePath
              ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
              : inactiveNavClass
          }`}
          title={copy.home}
        >
          <HomeIcon className={isHomePath ? 'opacity-100' : 'opacity-70'} size={24} />
          <span className="text-xs mt-1 font-medium">{copy.home}</span>
        </Link>

        {/* 커뮤니티 버튼 */}
        <Link
          href={href('/c')}
          prefetch={true}
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
            normalizedPathname === '/c' || normalizedPathname.startsWith('/c/')
              ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
              : inactiveNavClass
          }`}
          title={copy.community}
        >
          <Users className={normalizedPathname === '/c' || normalizedPathname.startsWith('/c/') ? 'opacity-100' : 'opacity-70'} size={24} />
          <span className="text-xs mt-1 font-medium">{copy.community}</span>
        </Link>

        {/* My Blog 버튼 */}
        <Link
          href={myBlogUrl}
          prefetch={true}
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
            normalizedPathname === myBlogUrl
              ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
              : inactiveNavClass
          }`}
          title={copy.myBlog}
        >
          <MyBlogIcon className={normalizedPathname === myBlogUrl ? 'opacity-100' : 'opacity-70'} size={24} />
          <span className="text-xs mt-1 font-medium">{copy.myBlog}</span>
        </Link>

        <>
            {/* 글쓰기 버튼 */}
            <Link
              href={href('/new-story')}
              prefetch={true}
              onMouseEnter={() => {
                // 전역 스타일 사이드이펙트를 막기 위해 에디터 모듈 직접 import는 피하고,
                // 라우트 prefetch만 수행한다.
                router.prefetch(href('/new-story'));
              }}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
                normalizedPathname === '/new-story' || normalizedPathname.startsWith('/edit/')
                  ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
                  : inactiveNavClass
              }`}
              title={copy.write}
            >
              <WriteIcon className={normalizedPathname === '/new-story' || normalizedPathname.startsWith('/edit/') ? 'opacity-100' : 'opacity-70'} size={24} />
              <span className="text-xs mt-1 font-medium">{copy.write}</span>
            </Link>

            {/* 북마크 버튼 */}
            <Link
              href={href('/bookmarks')}
              prefetch={true}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
                normalizedPathname === '/bookmarks'
                  ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
                  : inactiveNavClass
              }`}
              title={copy.bookmarks}
            >
              <BookmarkIcon className={normalizedPathname === '/bookmarks' ? 'opacity-100' : 'opacity-70'} size={24} />
              <span className="text-xs mt-1 font-medium">{copy.bookmarks}</span>
            </Link>

            {/* 채팅(DM) 버튼 */}
            <button
              type="button"
              onClick={() => openDMModal()}
              className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${inactiveNavClass}`}
              title={copy.chat}
            >
              <MessageCircle className="opacity-70" size={24} />
              <span className="text-xs mt-1 font-medium">{copy.chat}</span>
              {/* 읽지 않은 메시지 뱃지 (향후 API 연동 시 표시) */}
              {/* {unreadDMCount > 0 && (
                <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                  {unreadDMCount > 99 ? '99+' : unreadDMCount}
                </span>
              )} */}
            </button>

            {/* 설정 버튼 */}
            <Link
              href={href('/settings')}
              prefetch={true}
              className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
                normalizedPathname === '/settings' || normalizedPathname.startsWith('/settings/')
                  ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
                  : inactiveNavClass
              }`}
              title={copy.settings}
            >
              <SettingsIcon className={normalizedPathname === '/settings' || normalizedPathname.startsWith('/settings/') ? 'opacity-100' : 'opacity-70'} size={24} />
              <span className="text-xs mt-1 font-medium">{copy.settings}</span>
            </Link>

            {/* 알림 드롭다운 (Feature Flag) */}
            {FEATURES.NOTIFICATIONS && (
            <DropdownMenu open={isNotificationOpen} onOpenChange={setIsNotificationOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-colors ${
                    isNotificationOpen
                      ? 'bg-[#D8E6EA] text-[#264653] dark:bg-[#1D3A36] dark:text-[#B9E6DC]'
                      : inactiveNavClass
                  }`}
                  title={copy.notifications}
                >
                  <NotificationBellIcon className={isNotificationOpen ? 'opacity-100' : 'opacity-70'} size={24} />
                  <span className="text-xs mt-1 font-medium">{copy.notifications}</span>
                  {/* 읽지 않은 알림 뱃지 */}
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-96 ml-2">
                <NotificationDropdown onClose={() => setIsNotificationOpen(false)} />
              </DropdownMenuContent>
            </DropdownMenu>
            )}
        </>
      </nav>
    </aside>
  );
}
