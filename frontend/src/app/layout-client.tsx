'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import Header from '@/components/layout/Header';
import LeftSidebar from '@/components/layout/LeftSidebar';
import BottomNavBar from '@/components/layout/BottomNavBar';
import MainContent from '@/components/layout/MainContent';
import ClientProviders from '@/components/ClientProviders';
import PublicSiteFrame from '@/components/public-site/PublicSiteFrame';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { DMModalProvider } from '@/components/dm/DMModalProvider';
import { MusicProvider } from '@/providers/MusicProvider';
import { MusicPlayerDropdown } from '@/components/music';
import { Debug } from '@/components/debug/Debug';
import { CacheClearButton } from '@/components/CacheClearButton';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';
import { useAuth } from '@/providers/AuthProviderV2';
import {
  isAlwaysPublicPath,
  isAuthPath,
  isLayoutlessPath,
  isLegalPath,
  isLoggedOutLandingPath,
  isPotentialPublicBlogPath,
  isPublicCommunityPath,
} from '@/lib/layout-shell';
import { stripLocalePrefix } from '@/lib/i18n/config';
import { isMobileInteraction, MOBILE_RESET_EVENT } from '@/utils/interaction';

interface LayoutClientProps {
  children: React.ReactNode;
}

export default function LayoutClient({ children }: LayoutClientProps) {
  useEffect(() => {
    if (!isMobileInteraction()) {
      return;
    }

    const resetOverlays = () => {
      document.body.removeAttribute('data-scroll-locked');
      document.body.style.overflow = '';
      document.body.style.userSelect = '';
      window.dispatchEvent(new Event(MOBILE_RESET_EVENT));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        resetOverlays();
        return;
      }
      resetOverlays();
    };

    const handlePageShow = () => resetOverlays();
    const handlePageHide = () => resetOverlays();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <ClientProviders>
        <MusicProvider>
          <DMModalProvider>
            <CacheClearButton />
            <Debug />

            <LayoutChrome>{children}</LayoutChrome>

            <FeedbackModal />
            <MusicPlayerDropdown />

            <Toaster
              position="top-center"
              richColors
              expand={false}
              gap={16}
            />
          </DMModalProvider>
        </MusicProvider>
      </ClientProviders>
    </ThemeProvider>
  );
}

function LayoutChrome({ children }: LayoutClientProps) {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname || '/');
  const { user, isLoading: authLoading } = useAuth();
  const [hideLegalLayoutFromAuth, setHideLegalLayoutFromAuth] = useState(false);

  const isLayoutlessPage = isLayoutlessPath(normalizedPathname);
  const isAuthPage = isAuthPath(normalizedPathname);
  const isLegalPage = isLegalPath(normalizedPathname);
  const shouldHideLayout = isLayoutlessPage || isAuthPage || (isLegalPage && hideLegalLayoutFromAuth);
  const isAlwaysPublicPage = isAlwaysPublicPath(normalizedPathname);
  const isPublicReadablePage =
    isLoggedOutLandingPath(normalizedPathname) ||
    isPublicCommunityPath(normalizedPathname) ||
    isPotentialPublicBlogPath(normalizedPathname);

  const shouldDelayShellDecision =
    !shouldHideLayout &&
    !isAlwaysPublicPage &&
    isPublicReadablePage &&
    authLoading;

  const shouldUsePublicMarketingShell =
    !shouldHideLayout &&
    (
      isAlwaysPublicPage ||
      (!user && !authLoading && isLoggedOutLandingPath(normalizedPathname))
    );

  const shouldUsePublicContentShell =
    !shouldHideLayout &&
    !user &&
    !authLoading &&
    !isLoggedOutLandingPath(normalizedPathname) &&
    (isPublicCommunityPath(normalizedPathname) || isPotentialPublicBlogPath(normalizedPathname));

  useEffect(() => {
    if (isLegalPage) {
      setHideLegalLayoutFromAuth(sessionStorage.getItem('from-auth') === 'true');
      return;
    }

    if (!isAuthPage) {
      sessionStorage.removeItem('from-auth');
      sessionStorage.removeItem('auth-pathname');
    }

    setHideLegalLayoutFromAuth(false);
  }, [isAuthPage, isLegalPage]);

  if (shouldDelayShellDecision) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0E141B]">
        {children}
      </div>
    );
  }

  if (shouldUsePublicMarketingShell) {
    return <PublicSiteFrame>{children}</PublicSiteFrame>;
  }

  if (shouldUsePublicContentShell) {
    return <PublicSiteFrame variant="content">{children}</PublicSiteFrame>;
  }

  if (shouldHideLayout) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0E141B]">
        <MainContent>
          {children}
        </MainContent>
      </div>
    );
  }

  return (
    <div className="relative">
      <Header />
      <div className="h-[132px] md:h-[88px]" />
      <div
        className="flex min-h-[calc(100vh-72px)] bg-white dark:bg-[#0E141B]"
        style={{ border: 'none', transition: 'none' }}
      >
        <LeftSidebar />
        <MainContent>
          {children}
        </MainContent>
      </div>
      <BottomNavBar />
    </div>
  );
}
