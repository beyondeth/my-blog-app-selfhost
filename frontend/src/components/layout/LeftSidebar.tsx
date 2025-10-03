'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useDMModal } from '@/hooks/useDMModal';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { WriteIcon } from '@/components/icons/WriteIcon';
import { ChatIcon } from '@/components/icons/ChatIcon';
import { NotificationBellIcon } from '@/components/icons/NotificationBellIcon';
import { MyBlogIcon } from '@/components/icons/MyBlogIcon';

/**
 * 왼쪽 고정 사이드바 컴포넌트
 * 유튜브 스타일의 네비게이션 제공
 * - 홈: 메인 페이지로 이동
 * - 글쓰기: 새 포스트 작성 (로그인 사용자만)
 * - 채팅: DM 모달 열기 (로그인 사용자만)
 * - 알림: 알림 확인 (로그인 사용자만, 읽지 않은 알림 뱃지 표시)
 */
export default function LeftSidebar() {
  const { user } = useAuth();
  const { openModal } = useDMModal();
  const pathname = usePathname();
  const router = useRouter();

  // 읽지 않은 알림 수 조회 (로그인한 사용자만)
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
    enabled: !!user, // 로그인한 사용자만 쿼리 실행
    refetchInterval: 30000, // 30초마다 새로고침
  });

  // 글쓰기 버튼 클릭 핸들러
  const handleWriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    if (!user) {
      router.push('/login');
      return;
    }

    // 블로그가 있으면 글쓰기 페이지로 이동
    if (user.blogSlug) {
      router.push('/new-story');
    } else {
      // 블로그가 없으면 홈으로 (신규 사용자는 자동 생성되므로 발생하지 않아야 함)
      console.error('User does not have a blog. This should not happen for new users.');
      router.push('/');
    }
  }, [user, router]);

  // 알림 페이지로 이동 핸들러
  const handleNotificationClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    router.push('/notifications');
  }, [router]);

  // Admin 페이지에서는 사이드바를 숨김
  const isAdminPage = pathname?.startsWith('/admin');
  if (isAdminPage) {
    return null;
  }

  return (
    <aside className="hidden lg:block fixed left-0 top-0 h-screen w-20 bg-background border-r border-border z-40">
      <nav className="flex flex-col items-center py-6 space-y-6">
        {/* 홈 버튼 */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all ${
            pathname === '/'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
          }`}
          title="홈"
        >
          <HomeIcon className={pathname === '/' ? 'opacity-100' : 'opacity-70'} size={24} />
          <span className="text-xs mt-1 font-medium">홈</span>
        </Link>

        {/* My Blog 버튼 - 로그인 사용자만 표시 */}
        {user && user.blogSlug && (
          <Link
            href={`/blog/${user.blogSlug}`}
            className={`flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all ${
              pathname === `/blog/${user.blogSlug}`
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            }`}
            title="내 블로그"
          >
            <MyBlogIcon className={pathname === `/blog/${user.blogSlug}` ? 'opacity-100' : 'opacity-70'} size={24} />
            <span className="text-xs mt-1 font-medium">내블로그</span>
          </Link>
        )}

        {/* 로그인한 사용자만 보이는 메뉴 */}
        {user && (
          <>
            {/* 글쓰기 버튼 */}
            <button
              onClick={handleWriteClick}
              className="flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              title="글쓰기"
            >
              <WriteIcon className="opacity-70" size={24} />
              <span className="text-xs mt-1 font-medium">글쓰기</span>
            </button>

            {/* 채팅 버튼 */}
            <button
              onClick={() => openModal()}
              className="flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              title="채팅"
            >
              <ChatIcon className="opacity-70" size={24} />
              <span className="text-xs mt-1 font-medium">채팅</span>
            </button>

            {/* 알림 버튼 */}
            <button
              onClick={handleNotificationClick}
              className={`relative flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-all ${
                pathname === '/notifications'
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
              title="알림"
            >
              <NotificationBellIcon className={pathname === '/notifications' ? 'opacity-100' : 'opacity-70'} size={24} />
              <span className="text-xs mt-1 font-medium">알림</span>
              {/* 읽지 않은 알림 뱃지 */}
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </>
        )}
      </nav>
    </aside>
  );
}
