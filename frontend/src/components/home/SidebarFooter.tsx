'use client';

import Link from 'next/link';

/**
 * SidebarFooter - 오른쪽 사이드바 하단 푸터
 *
 * 커뮤니티 가이드, 개인정보 처리방침, 이용 약관 등의 링크 제공
 */
export default function SidebarFooter() {
  return (
    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700 pb-8">
      {/* 링크 섹션 - 3개 링크를 한 줄에 배치 */}
      <div className="flex justify-between items-center mb-3">
        <Link
          href="/legal/terms"
          className="text-sm text-gray-500 dark:text-gray-400 transition-colors"
        >
          Terms
        </Link>
        <Link
          href="/legal/privacy"
          className="text-sm text-gray-500 dark:text-gray-400 transition-colors"
        >
          Privacy
        </Link>
        <Link
          href="/legal/guidelines"
          className="text-sm text-gray-500 dark:text-gray-400 transition-colors"
        >
          Community Guide
        </Link>
      </div>

      {/* 저작권 표시 */}
      <div className="mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Codebase, Inc. © 2025. All rights reserved.
        </p>
      </div>

      {/* 빈 공간 한 줄 */}
      <div className="h-4"></div>
    </div>
  );
}