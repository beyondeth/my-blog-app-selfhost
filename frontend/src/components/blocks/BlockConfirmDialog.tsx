"use client";

import { useState, useEffect } from 'react';
import { FiAlertCircle } from 'react-icons/fi';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface BlockConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => Promise<void>;
  username?: string;
  isBlocking?: boolean;
}

/**
 * 사용자 차단 확인 다이얼로그 (Radix Dialog 기반)
 * 차단 효과를 안내하고 확인을 받는 컴포넌트
 */
export default function BlockConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  username,
  isBlocking = false,
}: BlockConfirmDialogProps) {
  const [reason, setReason] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // 모달이 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      // 애니메이션 완료 후 초기화
      const timer = setTimeout(() => {
        setReason('');
        setIsSuccess(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // 성공 시 1.5초 후 자동으로 모달 닫기
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, onOpenChange]);

  const handleConfirm = async () => {
    try {
      await onConfirm(reason || undefined);
      setIsSuccess(true); // 성공 상태로 전환
    } catch (error) {
      // 에러는 useBlock hook에서 처리됨
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => {
          // DropdownMenu 트리거 버튼에서 포커스 제거
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
      >
        {isSuccess ? (
          /* Success Screen */
          <div className="text-center py-8">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg
                className="h-10 w-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              차단되었습니다
            </h3>
            <p className="text-sm text-gray-600">
              이제 이 사용자로부터 메시지를 받지 않습니다
            </p>
          </div>
        ) : (
          /* Confirm Screen */
          <>
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
                <DialogTitle>사용자 차단</DialogTitle>
              </div>
              {username && (
                <DialogDescription className="text-base">
                  <span className="font-semibold text-gray-900">{username}</span>
                  님을 차단하시겠습니까?
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="space-y-4">
              {/* Warning Box */}
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900 mb-2">
                  차단 시 다음과 같은 효과가 있습니다:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                  <li>이 사용자로부터 메시지를 받을 수 없습니다</li>
                  <li>이 사용자가 내 콘텐츠를 볼 수 없습니다</li>
                  <li>차단은 언제든지 해제할 수 있습니다</li>
                </ul>
              </div>

              {/* Optional Reason */}
              <div>
                <label
                  htmlFor="block-reason"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  차단 사유 (선택사항)
                </label>
                <textarea
                  id="block-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm resize-none"
                  placeholder="차단 사유를 입력해주세요 (선택사항)"
                />
                <p className="mt-1 text-xs text-gray-500">{reason.length}/500</p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors min-h-[44px]"
                  disabled={isBlocking}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isBlocking}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-h-[44px]"
                >
                  {isBlocking ? '차단 중...' : '차단하기'}
                </button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
