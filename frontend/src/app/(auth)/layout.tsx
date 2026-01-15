'use client';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 인증 전용 레이아웃
 * 로그인, 회원가입, 비밀번호 찾기, 약관 동의 등 인증 관련 페이지에서 사용
 * 헤더, 사이드바, 하단 네비게이션 바 없이 순수 컨텐츠만 표시
 * forgot-password 페이지는 전체 너비를 사용하고, 다른 인증 페이지는 중앙 정렬 적용
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* 그라디언트 배경 효과를 위한 CSS 클래스 지원 */}
      <style jsx global>{`
        .auth-gradient-light {
          background: linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%);
        }
        .auth-gradient-dark {
          background: linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%);
        }
        .blur-orb-1 {
          position: absolute;
          width: 400px;
          height: 400px;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.1) 0%, transparent 70%);
          filter: blur(60px);
          top: 10%;
          left: 10%;
        }
        .blur-orb-2 {
          position: absolute;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 70%);
          filter: blur(40px);
          bottom: 20%;
          right: 10%;
        }
        .fade-in-up {
          animation: fadeInUp 0.6s ease-out;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .shake {
          animation: shake 0.5s ease-in-out;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>

      {/* 중앙 정렬된 인증 컨텐츠 - forgot-password는 전체 너비 사용 */}
      <div className={`w-full ${pathname === '/forgot-password' ? '' : 'max-w-lg'}`}>
        {children}
      </div>
    </div>
  );
}
