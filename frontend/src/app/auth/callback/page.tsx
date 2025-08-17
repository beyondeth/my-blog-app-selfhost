'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { checkAuth } = useAuth();
  
  useEffect(() => {
    const handleCallback = async () => {
      const success = searchParams.get('success');
      const error = searchParams.get('error');
      
      if (success === 'true') {
        // OAuth 로그인 성공 - 쿠키는 이미 설정되어 있음
        // 사용자 정보를 다시 불러와서 상태 업데이트
        await checkAuth();
        
        // 홈 페이지로 리다이렉트
        router.replace('/');
      } else if (error) {
        // 에러 처리
        console.error('OAuth login error:', error);
        router.replace(`/login?error=${encodeURIComponent(error)}`);
      } else {
        // 예상치 못한 상황
        router.replace('/login');
      }
    };
    
    handleCallback();
  }, [searchParams, router, checkAuth]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">로그인 처리 중...</p>
      </div>
    </div>
  );
}