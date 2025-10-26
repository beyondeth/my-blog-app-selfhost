'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Home, UserPlus } from 'lucide-react';
import Link from 'next/link';

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
  const [errorInfo, setErrorInfo] = useState<{
    code: string;
    message: string;
    remainingDays: number;
  } | null>(null);

  useEffect(() => {
    if (hasProcessed.current) {
      return;
    }

    const handleCallback = () => {
      hasProcessed.current = true;

      const error = searchParams.get('error');
      const message = searchParams.get('message');
      const remainingDays = parseInt(searchParams.get('remainingDays') || '0');

      if (error) {
        // 삭제된 계정 에러면 전체 화면 UI 표시
        if (error === 'ACCOUNT_DELETED') {
          setErrorInfo({
            code: error,
            message: decodeURIComponent(message || '계정이 삭제되었습니다.'),
            remainingDays,
          });
        } else {
          // 다른 에러는 로그인 페이지로 리다이렉트
          console.error('OAuth login error:', error);
          router.replace(`/login?error=${encodeURIComponent(error)}`);
        }
      } else {
        // 정상적인 경우 백엔드에서 이미 /consent 또는 /로 리다이렉트했으므로
        // 이 페이지에 도달하지 않음. 혹시 도달한 경우 홈으로 이동
        router.replace('/');
      }
    };

    handleCallback();
  }, [searchParams, router]);

  // 삭제된 계정 에러 전체 화면 UI
  if (errorInfo?.code === 'ACCOUNT_DELETED') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800 p-8">
            {/* 아이콘 */}
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
                <AlertCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>

            {/* 제목 */}
            <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
              계정이 삭제되었습니다
            </h1>

            {/* 메시지 */}
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
              {errorInfo.message}
            </p>

            {/* 버튼들 */}
            <div className="space-y-3">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Home className="h-4 w-4" />
                로그인 페이지로 돌아가기
              </Link>

              {errorInfo.remainingDays === 0 && (
                <Link
                  href="/register"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 text-sm font-medium text-white bg-black dark:bg-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <UserPlus className="h-4 w-4" />
                  회원가입하기
                </Link>
              )}
            </div>

            {/* 추가 안내 */}
            <p className="mt-6 text-xs text-center text-gray-500 dark:text-gray-500">
              재가입 시 새로운 계정이 생성됩니다
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 로딩 화면
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-gray-900 dark:border-gray-700 dark:border-t-gray-100 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">로그인 처리 중...</p>
      </div>
    </div>
  );
}