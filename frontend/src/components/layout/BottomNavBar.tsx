'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useCallback } from 'react';
import { HomeIcon } from '@/components/icons/HomeIcon';
import { MyBlogIcon } from '@/components/icons/MyBlogIcon';
import { BookmarkIcon } from '@/components/icons/BookmarkIcon';
import { Plus, Users } from 'lucide-react';

/**
 * 모바일 하단 네비게이션 바 컴포넌트
 * 앱과 같은 네이티브한 느낌을 주는 하단 고정 메뉴
 * - 홈: 메인 페이지
 * - 내 블로그: 내 블로그 페이지 (로그인 시)
 * - 글쓰기: 새 포스트 작성 (로그인 시)
 * - 북마크: 저장한 포스트 (로그인 시)
 * - 설정: 설정 페이지 (로그인 시)
 */
export default function BottomNavBar() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // 글쓰기 버튼 클릭 핸들러
  const handleWriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    if (!user) {
      router.push('/login');
      return;
    }

    if (user.blogSlug) {
      router.push('/new-story');
    } else {
      console.error('User does not have a blog. This should not happen for new users.');
      router.push('/');
    }
  }, [user, router]);

  // 로그인 필요 페이지 클릭 핸들러
  const handleAuthRequiredClick = useCallback((e: React.MouseEvent, href: string) => {
    if (!user) {
      e.preventDefault();
      router.push('/login');
    }
  }, [user, router]);

  // Admin, 로그인, 회원가입 페이지에서는 바텀바를 숨김
  const isAdminPage = pathname?.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';
  if (isAdminPage || isAuthPage) {
    return null;
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border shadow-lg z-50 overflow-visible">
      <div className="grid grid-cols-5 items-center h-16 w-full px-3 overflow-visible">
        {/* 홈 버튼 - 항상 표시 */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center transition-colors min-w-0 ${
            pathname === '/'
              ? 'text-primary'
              : 'text-muted-foreground'
          }`}
        >
          <HomeIcon size={16} />
          <span className="hidden xs:block text-xs mt-0.5">홈</span>
        </Link>

        {/* 내 블로그 버튼 - 로그인 시에만 활성화 */}
        {user && user.blogSlug ? (
          <Link
            href={`/${user.blogSlug}`}
            className={`flex flex-col items-center justify-center transition-colors min-w-0 ${
              pathname === `/${user.blogSlug}`
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <MyBlogIcon size={16} />
            <span className="hidden xs:block text-xs mt-0.5">내블로그</span>
          </Link>
        ) : (
          <button
            onClick={(e) => handleAuthRequiredClick(e, '/login')}
            className="flex flex-col items-center justify-center text-muted-foreground opacity-50 min-w-0"
          >
            <MyBlogIcon size={16} />
            <span className="hidden xs:block text-xs mt-0.5">내블로그</span>
          </button>
        )}

        {/* 글쓰기 버튼 - 로그인 시에만 활성화 */}
        <div className="relative flex h-16 items-end justify-center">
          <button
            type="button"
            onClick={handleWriteClick}
            aria-label="글쓰기"
            className="absolute -top-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Plus size={24} strokeWidth={2.5} />
          </button>
        </div>

        {/* 커뮤니티 버튼 - 항상 표시 */}
        <Link
          href="/c"
          className={`flex flex-col items-center justify-center transition-colors min-w-0 ${
            pathname?.startsWith('/c')
              ? 'text-primary'
              : 'text-muted-foreground'
          }`}
        >
          <Users size={20} strokeWidth={1.5} />
          <span className="hidden xs:block text-xs mt-0.5">커뮤니티</span>
        </Link>

        {/* 북마크 버튼 - 로그인 시에만 활성화 */}
        {user ? (
          <Link
            href="/bookmarks"
            className={`flex flex-col items-center justify-center transition-colors min-w-0 ${
              pathname === '/bookmarks'
                ? 'text-primary'
                : 'text-muted-foreground'
            }`}
          >
            <BookmarkIcon size={16} />
            <span className="hidden xs:block text-xs mt-0.5">북마크</span>
          </Link>
        ) : (
          <button
            onClick={(e) => handleAuthRequiredClick(e, '/login')}
            className="flex flex-col items-center justify-center text-muted-foreground opacity-50 min-w-0"
          >
            <BookmarkIcon size={16} />
            <span className="hidden xs:block text-xs mt-0.5">북마크</span>
          </button>
        )}
      </div>
    </nav>
  );
}
