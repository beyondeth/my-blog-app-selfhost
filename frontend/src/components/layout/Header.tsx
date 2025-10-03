'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { FiEdit3, FiLogOut, FiMenu, FiX, FiSearch } from 'react-icons/fi';
import { routes, navigation } from '@/lib/navigation';
import ProfileDropdown from './ProfileDropdown';
import NotificationIcon from '../notifications/NotificationIcon';
import SubscriptionBadge from '../subscription/SubscriptionBadge';
import { ThemeSwitch } from '@/components/ui/ThemeSwitch';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useDMModal } from '@/hooks/useDMModal';

export default function Header() {
  const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
  const { openModal } = useDMModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 홈 페이지로 이동 (캐시 보존)
  const handleHomeNavigation = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // 모바일 메뉴 닫기
    setIsMobileMenuOpen(false);
    
    // 홈으로 이동 (모든 검색 파라미터 초기화)
    router.push('/');
    
    // 이미 홈 페이지에 있다면 스크롤을 맨 위로
    if (pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
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


  // Handle write button click
  const handleWriteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    closeMobileMenu();

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

  // 외부 클릭으로 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
      // 모바일 메뉴가 열렸을 때 스크롤 방지
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  // 경로 변경 시 메뉴 닫기
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Admin 페이지에서는 헤더를 숨김
  const isAdminPage = pathname?.startsWith('/admin');
  if (isAdminPage) {
    return null;
  }

  return (
    <header className="border-b border-border sticky top-0 z-50 bg-background" ref={mobileMenuRef}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <a 
              href={routes.home()}
              onClick={handleHomeNavigation}
              className="hover:opacity-80 transition-opacity cursor-pointer flex items-center space-x-2"
            >
              {/* Code Icon - 모던한 그라데이션 적용 */}
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-3 flex items-center justify-center min-w-[48px] min-h-[48px] shadow-md hover:shadow-lg transition-shadow">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l-4 4 4 4M18 8l4 4-4 4M14 7l-4 10"/>
                </svg>
              </div>
              {/* Text - 다크모드 지원 */}
              <div className="flex flex-col">
                <span className="text-xl font-bold text-foreground leading-tight">codebase.</span>
                <span className="text-xl font-bold text-foreground leading-tight -mt-1">blog</span>
              </div>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8 flex-1">
            {/* Search Bar - Medium Style */}
            <div className="max-w-sm ml-8">
              <form onSubmit={handleSearch} className="relative">
                <div className={`flex items-center bg-card dark:bg-[rgb(38,38,38)] rounded-full px-5 py-3.5 transition-all ${
                  isSearchFocused ? 'bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 shadow-md ring-2 ring-primary/20' : 'hover:bg-gray-100 dark:hover:bg-[rgb(45,45,45)]'
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

                  {/* Profile Dropdown */}
                  <ProfileDropdown
                    user={user}
                    onLogout={() => logout('/')}
                    onWriteClick={handleWriteClick}
                  />

                  {/* Subscription Badge - user.subscriptionTier 사용 */}
                  <SubscriptionBadge user={user} />
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

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? (
              <FiX className="w-5 h-5" />
            ) : (
              <FiMenu className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden mt-3">
          <form onSubmit={handleSearch} className="relative">
            <div className="flex items-center bg-muted dark:bg-[rgb(38,38,38)] rounded-full px-5 py-3.5">
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

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-border animate-in slide-in-from-top-1 duration-200">
            <div className="pt-4 space-y-4">
              {/* Navigation Links */}
              <div className="space-y-3">
                <Link
                  href="/analytics"
                  onClick={closeMobileMenu}
                  className="block text-base text-foreground hover:text-foreground/80 py-2 px-2 rounded-md hover:bg-muted transition-colors"
                >
                  📊 분석
                </Link>
              </div>

              {/* Mobile Auth Section */}
              <div className="pt-4 border-t border-border">
                {authLoading ? (
                  // 모바일 로딩 UI
                  <div className="space-y-3">
                    <div className="w-full h-10 bg-muted rounded animate-pulse"></div>
                  </div>
                ) : user ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-2 py-2">
                      <span className="text-[15px] text-muted-foreground">
                        {user.username}님
                      </span>
                      {/* Mobile Subscription Badge - user.subscriptionTier 사용 */}
                      <SubscriptionBadge user={user} />
                    </div>

                    {/* My Blog Button for Mobile - user.blogSlug로 즉시 표시 */}
                    {user.blogSlug && (
                      <Link
                        href={`/blog/${user.blogSlug}`}
                        onClick={closeMobileMenu}
                        className="block text-center py-2 px-2 text-[15px] text-foreground hover:text-foreground/80 rounded-md hover:bg-muted transition-colors font-medium"
                      >
                        내 블로그
                      </Link>
                    )}
                    
                    {/* Write Button - All logged in users can write */}
                    <button
                      onClick={handleWriteClick}
                      className="inline-flex items-center px-4 py-3 text-[15px] font-medium text-foreground border border-border hover:border-border/80 hover:bg-muted rounded-full transition-all w-full justify-center"
                    >
                      <FiEdit3 className="mr-2 w-4 h-4" />
                      글쓰기
                    </button>

                    {/* DM Button for Mobile */}
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        openModal();
                      }}
                      className="flex items-center justify-center w-full px-4 py-3 text-[15px] font-medium text-foreground border border-border hover:border-border/80 hover:bg-muted rounded-full transition-all"
                    >
                      <svg
                        className="w-4 h-4 mr-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-4l-4 4z"
                        />
                      </svg>
                      메시지
                    </button>

                    {/* Theme Switch for Mobile */}
                    <div className="flex items-center justify-between px-2 py-2">
                      <span className="text-[15px] text-muted-foreground">테마</span>
                      <ThemeSwitch />
                    </div>

                    <button
                      onClick={() => {
                        closeMobileMenu();
                        logout('/');
                      }}
                      className="flex items-center space-x-2 text-[15px] text-muted-foreground hover:text-foreground py-2 px-2 rounded-md hover:bg-muted transition-colors w-full"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Theme Switch for Mobile - Non-authenticated */}
                    <div className="flex items-center justify-between px-2 py-2 mb-3">
                      <span className="text-[15px] text-muted-foreground">테마</span>
                      <ThemeSwitch />
                    </div>

                    <Link
                      href={routes.login()}
                      onClick={(e) => {
                        closeMobileMenu();
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
                      className="inline-flex items-center justify-center w-full px-4 py-3 text-[15px] font-medium bg-primary hover:bg-primary/90 text-primary-foreground rounded-full transition-all"
                    >
                      로그인
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 