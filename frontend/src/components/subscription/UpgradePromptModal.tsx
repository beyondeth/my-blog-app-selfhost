'use client';

import { useRouter } from 'next/navigation';

interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 업그레이드 유도 사유 (예: "MCP 자동포스팅 한도 초과") */
  reason: string;
  /** 현재 사용량 (옵션) */
  currentUsage?: number;
  /** 제한 수 (옵션) */
  limit?: number;
}

/**
 * 업그레이드 유도 모달
 * MCP 한도 초과, 프로 기능 접근 등에서 재사용
 */
export default function UpgradePromptModal({
  isOpen,
  onClose,
  reason,
  currentUsage,
  limit,
}: UpgradePromptModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-md w-full mx-4 p-6">
        {/* 아이콘 */}
        <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-6 h-6 text-gray-700 dark:text-zinc-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
            />
          </svg>
        </div>

        {/* 제목 */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100 text-center">
          플랜 업그레이드가 필요합니다
        </h3>

        {/* 사유 */}
        <p className="text-sm text-gray-600 dark:text-zinc-400 text-center mt-2">
          {reason}
        </p>

        {/* 사용량 표시 (있을 때만) */}
        {currentUsage !== undefined && limit !== undefined && limit > 0 && (
          <div className="mt-4 bg-gray-50 dark:bg-zinc-800 rounded-lg p-3">
            <div className="flex justify-between text-xs text-gray-500 dark:text-zinc-400 mb-1">
              <span>이번 달 사용량</span>
              <span>{currentUsage} / {limit}</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-700 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (currentUsage / limit) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 플랜 추천 */}
        <div className="mt-4 border border-gray-200 dark:border-zinc-700 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900 dark:text-zinc-100">Starter 플랜</p>
              <p className="text-xs text-gray-500 dark:text-zinc-400">MCP 200회/월 + 기본 분석</p>
            </div>
            <p className="font-semibold text-gray-900 dark:text-zinc-100">
              월 5,900원
            </p>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-gray-600 dark:text-zinc-400 bg-gray-100 dark:bg-zinc-800 rounded-lg hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            나중에
          </button>
          <button
            onClick={() => {
              onClose();
              router.push('/pricing');
            }}
            className="flex-1 px-4 py-2.5 text-sm text-white bg-black dark:bg-zinc-100 dark:text-zinc-900 rounded-lg hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors"
          >
            플랜 보기
          </button>
        </div>
      </div>
    </div>
  );
}
