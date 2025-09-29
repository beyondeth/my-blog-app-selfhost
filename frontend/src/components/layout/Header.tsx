'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/AuthProviderV2';
import { useUserBlogV2 } from '@/hooks/useUserBlogV2';
import { FiEdit3, FiLogOut, FiMenu, FiX, FiSearch } from 'react-icons/fi';
import { routes, navigation } from '@/lib/navigation';
import ProfileDropdown from './ProfileDropdown';
import NotificationIcon from '../notifications/NotificationIcon';
import SubscriptionBadge from '../subscription/SubscriptionBadge';
import { blogLogger } from '@/utils/logger';
import { createSearchUrl, parseSearchParams } from '@/lib/navigation';
import { useDMModal } from '@/hooks/useDMModal';

export default function Header() {
  const { user, isAdmin, logout, isLoading: authLoading } = useAuth();
  const { blog, loading: blogLoading, checkAndRedirect } = useUserBlogV2();
  const { openModal } = useDMModal();
  
  // Debug logging
  useEffect(() => {
    blogLogger.debug('[Header] Blog state changed', { 
      // 민감한 정보 제외
      hasBlog: !!blog, 
      loading: blogLoading 
    });
  }, [user?.username, blog, blogLoading]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckingBlog, setIsCheckingBlog] = useState(false);
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


  // Handle write button click with blog check
  const handleWriteClick = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (isCheckingBlog) return;
    
    setIsCheckingBlog(true);
    closeMobileMenu();
    
    try {
      const redirectPath = await checkAndRedirect();
      router.push(redirectPath);
    } catch (error) {
      console.error('Error checking blog:', error);
      // Fallback to home page if there's an error
      router.push('/');
    } finally {
      setIsCheckingBlog(false);
    }
  }, [checkAndRedirect, router, isCheckingBlog]);

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
    <header className="border-b border-gray-200 sticky top-0 z-50 bg-white" ref={mobileMenuRef}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-5">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center">
            <a 
              href={routes.home()}
              onClick={handleHomeNavigation}
              className="hover:opacity-80 transition-opacity cursor-pointer flex items-center space-x-2"
            >
              {/* Code Icon */}
              <div className="bg-blue-500 rounded-lg p-3 flex items-center justify-center min-w-[48px] min-h-[48px]">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 8l-4 4 4 4M18 8l4 4-4 4M14 7l-4 10"/>
                </svg>
              </div>
              {/* Text */}
              <div className="flex flex-col">
                <span className="text-xl font-bold text-black leading-tight">codebase.</span>
                <span className="text-xl font-bold text-black leading-tight -mt-1">blog</span>
              </div>
            </a>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8 flex-1">
            {/* Search Bar - Medium Style */}
            <div className="max-w-sm ml-8">
              <form onSubmit={handleSearch} className="relative">
                <div className={`flex items-center bg-gray-50 rounded-full px-5 py-3.5 transition-all ${
                  isSearchFocused ? 'bg-white border border-gray-300 shadow-sm' : 'hover:bg-gray-100'
                }`}>
                  <FiSearch className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    onFocus={() => setIsSearchFocused(true)}
                    onBlur={() => setIsSearchFocused(false)}
                    placeholder="Search"
                    className="flex-1 bg-transparent text-sm placeholder-gray-500 focus:outline-none w-48"
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
                  <div className="w-20 h-8 bg-gray-100 rounded animate-pulse"></div>
                </div>
              ) : user ? (
                <>
                  {/* My Blog Button */}
                  {!blogLoading && blog && (
                    <Link
                      href={`/blog/${blog.slug}`}
                      className="text-sm text-gray-900 hover:text-gray-800"
                    >
                      내 블로그
                    </Link>
                  )}

                  {/* Write Button - All logged in users can write */}
                  <button
                    onClick={handleWriteClick}
                    disabled={isCheckingBlog}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiEdit3 className="mr-1.5 w-4 h-4" />
                    {isCheckingBlog ? '확인 중...' : '글쓰기'}
                  </button>

                  {/* DM Button */}
                  <button
                    onClick={() => openModal()}
                    className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
                    title="메시지"
                  >
                    <svg
                      className="w-6 h-6"
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
                  </button>

                  {/* Notification Icon */}
                  <NotificationIcon />

                  {/* Profile Dropdown */}
                  <ProfileDropdown
                    user={user}
                    blog={blog}
                    blogLoading={blogLoading}
                    onLogout={() => logout('/')}
                    onWriteClick={handleWriteClick}
                    isCheckingBlog={isCheckingBlog}
                  />

                  {/* Subscription Badge - 프로필 오른쪽으로 이동 */}
                  <SubscriptionBadge />
                </>
              ) : (
                <Link
                  href={routes.login()}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium bg-black hover:bg-gray-800 text-white rounded-full transition-all"
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
              )}
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
            <div className="flex items-center bg-gray-50 rounded-full px-5 py-3.5">
              <FiSearch className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchInputChange}
                placeholder="Search"
                className="flex-1 bg-transparent text-sm placeholder-gray-500 focus:outline-none"
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
              />
            </div>
          </form>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200 animate-in slide-in-from-top-1 duration-200">
            <div className="pt-4 space-y-4">
              {/* Navigation Links */}
              <div className="space-y-3">
                <Link 
                  href="/analytics" 
                  onClick={closeMobileMenu}
                  className="block text-base text-gray-900 hover:text-gray-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  📊 분석
                </Link>
              </div>

              {/* Mobile Auth Section */}
              <div className="pt-4 border-t border-gray-100">
                {authLoading ? (
                  // 모바일 로딩 UI
                  <div className="space-y-3">
                    <div className="w-full h-10 bg-gray-100 rounded animate-pulse"></div>
                  </div>
                ) : user ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-2 py-2">
                      <span className="text-sm text-gray-600">
                        {user.username}님
                      </span>
                      {/* Mobile Subscription Badge */}
                      <SubscriptionBadge />
                    </div>
                    
                    {/* My Blog Button for Mobile */}
                    {!blogLoading && blog && (
                      <Link 
                        href={`/blog/${blog.slug}`}
                        onClick={closeMobileMenu}
                        className="block text-center py-2 px-2 text-sm text-gray-900 hover:text-gray-800 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        내 블로그
                      </Link>
                    )}
                    
                    {/* Write Button - All logged in users can write */}
                    <button
                      onClick={handleWriteClick}
                      disabled={isCheckingBlog}
                      className="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-full transition-all w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiEdit3 className="mr-2 w-4 h-4" />
                      {isCheckingBlog ? '확인 중...' : '글쓰기'}
                    </button>

                    {/* DM Button for Mobile */}
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        openModal();
                      }}
                      className="flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-full transition-all"
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
                    
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        logout('/');
                      }}
                      className="flex items-center space-x-2 text-sm text-gray-500 hover:text-gray-700 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors w-full"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>로그아웃</span>
                    </button>
                  </div>
                ) : (
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
                    className="inline-flex items-center justify-center w-full px-4 py-3 text-sm font-medium bg-black hover:bg-gray-800 text-white rounded-full transition-all"
                  >
                    로그인
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
} 