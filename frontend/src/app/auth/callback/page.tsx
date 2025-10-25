'use client';

import { useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * OAuth 콜백 페이지
 *
 * 참고: 백엔드에서 약관 동의 여부를 체크하여 /consent 또는 /로 직접 리다이렉트합니다.
 * 이 페이지는 에러 처리 또는 예외 상황을 위해 유지됩니다.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) {
      return;
    }

    const handleCallback = () => {
      hasProcessed.current = true;

      const error = searchParams.get('error');

      if (error) {
        // 에러가 있으면 로그인 페이지로 리다이렉트
        console.error('OAuth login error:', error);
        router.replace(`/login?error=${encodeURIComponent(error)}`);
      } else {
        // 정상적인 경우 백엔드에서 이미 /consent 또는 /로 리다이렉트했으므로
        // 이 페이지에 도달하지 않음. 혹시 도달한 경우 홈으로 이동
        router.replace('/');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">로그인 처리 중...</p>
      </div>
    </div>
  );
}