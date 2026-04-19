'use client';

// 동적 렌더링 강제 - prerendering 시 useContext 오류 방지
export const dynamic = 'force-dynamic';

import Link from 'next/link';

/**
 * 404 Not Found 페이지
 * 존재하지 않는 경로 접근 시 표시
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full p-6 text-center">
        <h1 className="text-6xl font-bold text-gray-300 dark:text-gray-700 mb-4">
          404
        </h1>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Page not found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The page you requested does not exist or has moved.
        </p>
        <Link
          href="/"
          className="inline-block px-4 py-2 bg-black text-white rounded-md hover:bg-gray-800 transition-colors"
        >
          Return home
        </Link>
      </div>
    </div>
  );
}
