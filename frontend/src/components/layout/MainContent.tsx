'use client';

import { usePathname } from 'next/navigation';

interface MainContentProps {
  children: React.ReactNode;
}

/**
 * 메인 콘텐츠 래퍼 컴포넌트
 * 페이지에 따라 왼쪽 여백을 조건부로 적용
 * 모바일에서는 하단 네비게이션 바를 위한 여백 추가
 */
export default function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();

  // Admin, 로그인, 회원가입 페이지에서는 여백 제거
  const isAdminPage = pathname?.startsWith('/admin');
  const isAuthPage = pathname === '/login' || pathname === '/register';
  const shouldRemoveMargin = isAdminPage || isAuthPage;

  return (
    <div className={`flex-1 ${shouldRemoveMargin ? '' : 'lg:ml-32 pb-20 lg:pb-0'}`}>
      {children}
    </div>
  );
}
