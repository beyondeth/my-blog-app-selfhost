"use client";

import { useSearchParams, useRouter } from "next/navigation";

/**
 * 토스페이먼츠 빌링인증 실패 페이지
 *
 * 토스 결제창에서 인증 실패/취소 시 리다이렉트되는 페이지
 * URL 쿼리에서 code, message를 추출하여 에러 메시지 표시
 */
export default function TossFailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const errorCode = searchParams.get("code") || "UNKNOWN";
  const errorMessage =
    searchParams.get("message") || "결제 인증에 실패했습니다";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg shadow-sm p-8 text-center">
        {/* 에러 아이콘 */}
        <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-red-600 dark:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
          결제 인증 실패
        </h2>
        <p className="text-sm text-red-500 mt-2">{errorMessage}</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">에러 코드: {errorCode}</p>

        <div className="flex gap-3 justify-center mt-6">
          <button
            onClick={() => router.push("/pricing")}
            className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.push("/")}
            className="px-6 py-2 bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
  );
}
