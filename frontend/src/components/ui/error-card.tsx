'use client';

import { useEffect } from 'react';

/**
 * 에러 발생 시 사용자에게 보여줄 안전한 UI 카드
 * - 중앙 정렬
 * - 에러 메시지 표시
 * - 복구 시도(reset) 버튼
 */
interface ErrorCardProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export function ErrorCard({
  error,
  reset,
  title = '오류가 발생했습니다',
  description = '페이지를 불러오는 도중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
}: ErrorCardProps) {
  useEffect(() => {
    // 에러 로깅 서비스(Sentry 등)가 있다면 여기서 호출
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 rounded-full bg-slate-100 p-4 dark:bg-slate-800">
        <svg
          className="h-10 w-10 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>

      <h2 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
        {title}
      </h2>
      <p className="mb-8 max-w-sm text-slate-500 dark:text-slate-400">
        {description}
      </p>

      <button
        onClick={reset}
        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
      >
        다시 시도하기
      </button>

      {/* 개발 환경에서만 구체적인 에러 메시지 노출 */}
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 w-full max-w-lg overflow-auto rounded bg-slate-100 p-4 text-left text-xs text-red-600 dark:bg-slate-900">
          {error.message}
          {error.digest && `\n(Digest: ${error.digest})`}
        </pre>
      )}
    </div>
  );
}
