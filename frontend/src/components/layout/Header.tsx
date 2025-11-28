'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback, memo, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { FiSearch } from 'react-icons/fi';
import { routes } from '@/lib/navigation';
import ProfileDropdown from './ProfileDropdown';
import MobileProfileDropdown from './MobileProfileDropdown';
import SubscriptionBadge from '../subscription/SubscriptionBadge';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { MusicPlayerButton } from '@/components/music';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { FEATURES } from '@/lib/features';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useTheme } from 'next-themes';

// ============================================
// SearchParamsSync: useSearchParams 사용 컴포넌트 (Suspense 필요)
// Header 전체가 아닌 이 컴포넌트만 Suspense 경계 내에 있음
// ============================================
interface SearchParamsSyncProps {
  onSearchQueryChange: (query: string) => void;
}

function SearchParamsSync({ onSearchQueryChange }: SearchParamsSyncProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const currentParams = parseSearchParams(searchParams.toString());
    onSearchQueryChange(currentParams.search || '');
  }, [searchParams, onSearchQueryChange]);

  return null; // UI 없음, 동기화 역할만
}

function HeaderComponent() {
  const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
  const { toggleSidebar } = useSidebarStore();
  const { resolvedTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  // useSearchParams는 SearchParamsSync 컴포넌트로 분리 (Suspense 경계 내에서만 사용)
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 테마 마운트 상태 관리 (Hydration mismatch 방지)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 홈 페이지로 이동 (캐시 보존)
  const handleHomeNavigation = (e: React.MouseEvent) => {
    e.preventDefault();

    // 홈으로 이동 (모든 검색 파라미터 초기화)
    router.push('/');

    // 이미 홈 페이지에 있다면 스크롤을 맨 위로
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // SearchParamsSync 콜백 (useCallback으로 안정적인 참조 유지)
  const handleSearchQueryFromParams = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle search submit
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // 블로그 페이지인지 확인 (pathname이 /[blogSlug] 형태)
    // 홈('/'), 포스트 상세('/p/...'), 설정('/settings/...') 등은 제외
    const isBlogPage = pathname &&
      !pathname.startsWith('/p/') &&
      !pathname.startsWith('/settings/') &&
      !pathname.startsWith('/new-story') &&
      !pathname.startsWith('/login') &&
      !pathname.startsWith('/register') &&
      !pathname.startsWith('/dm') &&
      !pathname.startsWith('/pricing') &&
      pathname !== '/' &&
      pathname.split('/').length === 2; // /[blogSlug] 형태만

    if (isBlogPage) {
      // 블로그 페이지: blogSlug 유지하면서 검색
      const params = new URLSearchParams();
      if (searchQuery.trim()) {
        params.set('search', searchQuery.trim());
      }
      params.set('page', '1');

      router.push(`${pathname}?${params.toString()}`);
    } else {
      // 홈 페이지 또는 기타 페이지: 홈으로 이동하면서 검색
      const newParams = {
        search: searchQuery.trim() || undefined,
        page: 1,
      };

      const newUrl = createSearchUrl(newParams);
      router.push(newUrl);
    }

    // Blur the search input after submission
    searchInputRef.current?.blur();
  }, [searchQuery, router, pathname]);

  // Handle search input change
  const handleSearchInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);




  // Admin 페이지에서는 헤더를 숨김
  const isAdminPage = pathname?.startsWith('/admin');
  if (isAdminPage) {
    return null;
  }

  return (
    <header className="border-b border-border sticky top-0 z-50 bg-background">
      {/* SearchParamsSync: useSearchParams를 사용하는 컴포넌트 (Suspense 필요)
          Header 전체가 아닌 이 작은 컴포넌트만 Suspense 경계 영향을 받음
          음악 플레이어 등 다른 요소는 영향받지 않음 */}
      <Suspense fallback={null}>
        <SearchParamsSync onSearchQueryChange={handleSearchQueryFromParams} />
      </Suspense>

      <div className="max-w-full ml-0 px-2 xs:px-3 sm:px-4 md:px-4 lg:pl-[43px] lg:pr-32 py-4 sm:py-5">
        <div className="flex items-center justify-between relative">
          {/* Hamburger Menu & Logo */}
          <div className="flex items-center space-x-4">
            {/* Hamburger Menu Button */}
            <button
              onClick={toggleSidebar}
              className="hidden lg:flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 hover:from-blue-500 hover:via-purple-500 hover:to-pink-500 hover:scale-110 hover:rotate-90 hover:shadow-[0_0_20px_rgba(168,85,247,0.6)] transition-all duration-300 ease-in-out group relative overflow-hidden"
              aria-label="사이드바 토글"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Image
                src="/assets/left-sidebar/menu.svg"
                alt="Menu"
                width={24}
                height={24}
                className="invert brightness-0 transition-transform duration-300 group-hover:rotate-180 relative z-10"
              />
            </button>

            {/* Logo */}
            <a
              href={routes.home()}
              onClick={handleHomeNavigation}
              className="hover:opacity-80 transition-opacity cursor-pointer flex items-center space-x-2"
            >
              {/* Logo Image - 벡터 로고 */}
              <div className="flex items-center justify-center min-w-[48px] min-h-[48px]">
                <Image
                  src="/assets/logo.svg"
                  alt="Codebase Blog Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                  priority
                />
              </div>
              {/* Text - Orbitron 폰트 적용 */}
              <span className="text-2xl font-bold text-foreground leading-tight" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Codebase
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8 flex-1">
            {/* Search Bar - Medium Style */}
            <div className="max-w-sm ml-6">
              <form onSubmit={handleSearch} className="relative">
                <div className={`flex items-center bg-gray-100 dark:bg-[rgb(30,30,30)] rounded-full px-5 py-3.5 transition-all border border-transparent ${
                  isSearchFocused ? 'bg-background !border-border shadow-md ring-2 ring-primary/20' : ''
                }`}>
                  <FiSearch className="w-5 h-5 text-muted-foreground mr-3 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search"
                    className="flex-1 bg-transparent text-[15px] placeholder-muted-foreground focus:outline-none w-48 text-foreground"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                  />
                </div>
              </form>
            </div>

            <div className="flex-1"></div>

            {/* Desktop Auth Section */}
            <div className="flex items-center space-x-4">
              {/* 음악 플레이어 버튼 - 자체 상태 관리 (Header 리렌더링과 분리) */}
              {/* MusicPlayerDropdown은 layout-client.tsx에서 Portal로 렌더링 */}
              <MusicPlayerButton />

              <ThemeSwitch />

              {!mounted ? (
                <div className="w-20 h-8 bg-muted rounded animate-pulse"></div>
              ) : authLoading ? (
                // 로딩 중일 때는 아무것도 표시하지 않거나 스켈레톤 UI
                <div className="w-20 h-8 bg-muted rounded animate-pulse"></div>
              ) : user ? (
                <>
                  {/* Profile Dropdown */}
                  <ProfileDropdown
                    user={user}
                    onLogout={() => logout('/')}
                  />

                  {/* Subscription Badge (Feature Flag) */}
                  {FEATURES.SUBSCRIPTION && <SubscriptionBadge user={user} />}
                </>
              ) : (
                <>
                  <Link
                    href={routes.login()}
                    className="inline-flex items-center justify-center px-4 py-2 text-[15px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-all"
                  onClick={(e) => {
                    // 회원가입 페이지에서 로그인 버튼 클릭 시 상태 초기화
                    if (pathname === '/register') {
                      e.preventDefault();
                      router.push('/login');
                      // 약간의 지연 후 회원가입 페이지 상태 초기화를 위한 새로고침
                      setTimeout(() => {
                        window.dispatchEvent(new Event('register-page-reset'));
                      }, 100);
                    }
                  }}
                >
                  로그인
                </Link>
                </>
              )}
            </div>
          </nav>

          {/* Mobile Auth Section */}
          <div className="md:hidden absolute right-2 xs:right-3 sm:right-4 flex items-center space-x-3">
            {/* 음악 플레이어 버튼 (모바일) - 자체 상태 관리 */}
            {/* MusicPlayerDropdown은 layout-client.tsx에서 Portal로 렌더링 */}
            <MusicPlayerButton />

            {/* Theme Switch - Always visible */}
            <ThemeSwitch />

            {!mounted ? (
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
            ) : authLoading ? (
              // 로딩 중
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
            ) : user ? (
              <>
                {/* 로그인 상태: 프로필 드롭다운 */}
                <MobileProfileDropdown
                  user={user}
                  onLogout={() => logout('/')}
                />
              </>
            ) : (
              // 비로그인 상태: 로그인 버튼
              <Link
                href={routes.login()}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-all"
                onClick={(e) => {
                  if (pathname === '/register') {
                    e.preventDefault();
                    router.push('/login');
                    setTimeout(() => {
                      window.dispatchEvent(new Event('register-page-reset'));
                    }, 100);
                  }
                }}
              >
                로그인
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden mt-3">
          <form onSubmit={handleSearch} className="relative">
            <div className="flex items-center bg-gray-100 dark:bg-[rgb(30,30,30)] rounded-full px-5 py-3.5">
              <FiSearch className="w-4 h-4 text-muted-foreground mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder="Search"
                className="flex-1 bg-transparent text-[15px] placeholder-muted-foreground focus:outline-none text-foreground"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          </form>
        </div>

      </div>
    </header>
  );
}

// React.memo로 래핑하여 props 변경 없이 부모 리렌더링 시 재렌더링 방지
// 음악 플레이어 상태 유지에 기여
export default memo(HeaderComponent);