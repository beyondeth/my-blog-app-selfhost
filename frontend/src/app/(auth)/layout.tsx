'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 인증 전용 레이아웃
 * 로그인, 회원가입, 약관 동의 등 인증 관련 페이지에서 사용
 * 헤더, 사이드바, 하단 네비게이션 바 없이 순수 컨텐츠만 표시
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  useEffect(() => {
    // 인증 페이지 방문 중임을 sessionStorage에 기록
    // 법적 문서 페이지에서 이 값을 확인하여 헤더/사이드바 숨김 여부 결정
    sessionStorage.setItem('from-auth', 'true');
    sessionStorage.setItem('auth-pathname', pathname);

    return () => {
      // 컴포넌트 언마운트 시에는 제거하지 않음
      // 법적 문서로 이동 후 뒤로가기 시에도 유지되어야 함
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* 중앙 정렬된 인증 컨텐츠 */}
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
