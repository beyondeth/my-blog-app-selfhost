'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { FiSearch, FiMessageCircle } from 'react-icons/fi';
import { routes } from '@/lib/navigation';
import ProfileDropdown from './ProfileDropdown';
import MobileProfileDropdown from './MobileProfileDropdown';
import SubscriptionBadge from '../subscription/SubscriptionBadge';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { FEATURES } from '@/lib/features';
import { useSidebarStore } from '@/stores/sidebarStore';
import { useTheme } from 'next-themes';
import { useDMModal } from '@/hooks/useDMModal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export default function Header() {
  const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
  const { toggleSidebar } = useSidebarStore();
  const { resolvedTheme } = useTheme();
  const { openModal } = useDMModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  // Initialize search query from URL params
  useEffect(() => {
    const currentParams = parseSearchParams(searchParams.toString());
    setSearchQuery(currentParams.search || '');
  }, [searchParams]);

  // Handle search submit
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const newParams = {
      search: searchQuery.trim() || undefined,
      page: 1,
    };
    
    const newUrl = createSearchUrl(newParams);
    router.push(newUrl);
    
    // Blur the search input after submission
    searchInputRef.current?.blur();
  }, [searchQuery, router]);

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
              {authLoading ? (
                // 로딩 중일 때는 아무것도 표시하지 않거나 스켈레톤 UI
                <div className="flex items-center space-x-4">
                  <div className="w-20 h-8 bg-muted rounded animate-pulse"></div>
                </div>
              ) : user ? (
                <>
                  {/* Theme Switch */}
                  <ThemeSwitch />

                  {/* DM Button */}
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => openModal()}
                          className="relative p-2 rounded-full border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                          aria-label="메시지"
                        >
                          <FiMessageCircle className="w-5 h-5 text-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" sideOffset={5}>
                        <p className="text-sm">메시지</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

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
                  {/* Theme Switch for non-authenticated users */}
                  <ThemeSwitch />

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
            {/* Theme Switch - Always visible */}
            <ThemeSwitch />

            {authLoading ? (
              // 로딩 중
              <div className="w-8 h-8 bg-muted rounded-full animate-pulse"></div>
            ) : user ? (
              <>
                {/* DM Button */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => openModal()}
                        className="relative p-2 rounded-full border border-transparent hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                        aria-label="메시지"
                      >
                        <FiMessageCircle className="w-5 h-5 text-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" sideOffset={5}>
                      <p className="text-sm">메시지</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

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