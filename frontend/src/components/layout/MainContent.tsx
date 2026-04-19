'use client';

import { usePathname } from 'next/navigation';
import { stripLocalePrefix } from '@/lib/i18n/config';

interface MainContentProps {
  children: React.ReactNode;
}

/**
 * 메인 콘텐츠 래퍼 컴포넌트
 * 페이지에 따라 왼쪽 여백을 조건부로 적용
 * 인증 페이지 및 Admin 페이지에서는 사이드바 공간 제거
 * 모바일에서는 하단 네비게이션 바를 위한 여백 추가
 */
export default function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const normalizedPathname = stripLocalePrefix(pathname || '/');

  // Admin, 인증, 커스텀 레이아웃 페이지에서는 여백 제거
  const isAdminPage = normalizedPathname.startsWith('/admin');
  const authPaths = ['/login', '/register', '/consent', '/forgot-password', '/reset-password'];
  const isAuthPage = authPaths.includes(normalizedPathname);
  const layoutlessPaths = [
    '/mock-home-shell',
    '/mock-home-shell-ko',
    '/mock-home-shell-ink',
    '/mock-home-shell-harbor',
    '/mock-home-shell-harbor-white',
  ];
  const isLayoutlessPage = layoutlessPaths.includes(normalizedPathname);
  const shouldRemoveMargin = isAdminPage || isAuthPage || isLayoutlessPage;
  const baseMarginClass = shouldRemoveMargin
    ? ''
    : 'lg:ml-32 pb-20 lg:pb-0';

  return (
    <div className={`flex-1 ${baseMarginClass}`}>
      {children}
    </div>
  );
}
