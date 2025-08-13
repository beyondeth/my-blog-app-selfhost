'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useUserBlog } from '@/hooks/useUserBlog';
import { FiEdit3, FiLogOut, FiMenu, FiX } from 'react-icons/fi';
import { routes, navigation } from '@/lib/navigation';
import ProfileDropdown from './ProfileDropdown';
import { blogLogger } from '@/utils/logger';

export default function Header() {
  const { user, isAdmin, logout } = useAuth();
  const { blog, loading: blogLoading, checkAndRedirect } = useUserBlog();
  
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCheckingBlog, setIsCheckingBlog] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

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
      // Fallback to blog creation page
      router.push('/blog/new');
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
          <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
            
            {/* Desktop Auth Section */}
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  {/* My Blog Button */}
                  {!blogLoading && (
                    <Link 
                      href={blog ? `/blog/${blog.slug}` : "/blog/new"}
                      className="text-sm text-gray-900 hover:text-amber-800"
                    >
                      {blog ? '내 블로그' : '블로그 만들기'}
                    </Link>
                  )}
                  
                  {/* Write Button - All logged in users can write */}
                  <button 
                    onClick={handleWriteClick}
                    disabled={isCheckingBlog}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiEdit3 className="mr-1 w-4 h-4" />
                    {isCheckingBlog ? '확인 중...' : '글쓰기'}
                  </button>
                  
                  {/* Profile Dropdown */}
                  <ProfileDropdown
                    user={user}
                    blog={blog}
                    blogLoading={blogLoading}
                    onLogout={() => logout('/')}
                    onWriteClick={handleWriteClick}
                    isCheckingBlog={isCheckingBlog}
                  />
                </>
              ) : (
                <Link 
                  href={routes.login()}
                  className="text-sm text-gray-900 hover:text-amber-800"
                >
                  로그인
                </Link>
              )}
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMobileMenu}
            className="md:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
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

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-gray-200 animate-in slide-in-from-top-1 duration-200">
            <div className="pt-4 space-y-4">
              {/* Navigation Links */}
              <div className="space-y-3">
                <Link 
                  href="/analytics" 
                  onClick={closeMobileMenu}
                  className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  📊 분석
                </Link>
              </div>

              {/* Mobile Auth Section */}
              <div className="pt-4 border-t border-gray-100">
                {user ? (
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 px-2 py-2">
                      <span className="text-sm text-gray-600">
                        {user.username}님
                      </span>
                    </div>
                    
                    {/* My Blog Button for Mobile */}
                    {!blogLoading && (
                      <Link 
                        href={blog ? `/blog/${blog.slug}` : "/blog/new"}
                        onClick={closeMobileMenu}
                        className="block text-center py-2 px-2 text-sm text-gray-900 hover:text-amber-800 rounded-md hover:bg-gray-50 transition-colors"
                      >
                        {blog ? '내 블로그' : '블로그 만들기'}
                      </Link>
                    )}
                    
                    {/* Write Button - All logged in users can write */}
                    <button 
                      onClick={handleWriteClick}
                      disabled={isCheckingBlog}
                      className="inline-flex items-center px-4 py-3 text-sm font-medium text-gray-700 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 rounded-md transition-all w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiEdit3 className="mr-2 w-4 h-4" />
                      {isCheckingBlog ? '확인 중...' : '글쓰기'}
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
                    onClick={closeMobileMenu}
                    className="block text-base text-gray-900 hover:text-amber-800 py-2 px-2 rounded-md hover:bg-gray-50 transition-colors"
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