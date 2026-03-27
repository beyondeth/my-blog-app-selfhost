'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * 마켓플레이스 구매 실패 페이지
 */
export default function PurchaseFailPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || '결제가 취소되었거나 실패했습니다';
  const code = searchParams.get('code');

  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0E141B] px-4">
      <div className="max-w-md w-full rounded-xl border border-gray-200 dark:border-zinc-800 p-8 text-center">
        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-red-500 text-lg">✕</span>
        </div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          결제 실패
        </h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">
          {message}
        </p>
        {code && (
          <p className="text-xs text-gray-400 mt-1">에러 코드: {code}</p>
        )}
        <Link
          href="/marketplace"
          className="mt-5 inline-block px-6 py-2.5 rounded-lg bg-gray-900 dark:bg-white text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-zinc-100"
        >
          마켓플레이스로 돌아가기
        </Link>
      </div>
    </div>
  );
}
