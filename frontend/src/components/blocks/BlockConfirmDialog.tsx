"use client";

import { useState, useEffect } from 'react';
import { FiSlash, FiCheck, FiX } from 'react-icons/fi'; // 아이콘 변경 (AlertCircle -> Slash for block)
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils'; // shadcn utils 가정

interface BlockConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason?: string) => Promise<void>;
  username?: string;
  isBlocking?: boolean;
}

/**
 * 사용자 차단 확인 다이얼로그 (Redesign)
 * Premium Aesthetic: Clean, Minimal, Dark Mode Support
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
      setIsSuccess(true);
    } catch (error) {
      // 에러는 useBlock hook에서 처리됨
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[400px] p-0 overflow-hidden bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-2xl gap-0"
        onOpenAutoFocus={(e) => {
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        }}
      >
        {isSuccess ? (
          /* Success Screen - Minimal & Elegant */
          <div className="flex flex-col items-center justify-center py-12 px-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
              <FiCheck className="w-6 h-6 text-zinc-900 dark:text-white" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
              차단 완료
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              이제 이 사용자의 활동이 숨겨집니다.
            </p>
          </div>
        ) : (
          /* Confirm Screen */
          <div className="flex flex-col">
            {/* Header Area */}
            <div className="px-6 pt-6 pb-2">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <FiSlash className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    사용자 차단
                  </DialogTitle>
                  <DialogDescription className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    <span className="font-medium text-zinc-900 dark:text-zinc-200">{username}</span>
                    님을 차단하시겠습니까?
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Warning Content - Subtle styling instead of heavy box */}
            <div className="px-6 py-4">
              <div className="text-sm text-zinc-600 dark:text-zinc-300 space-y-3 leading-relaxed">
                <p>
                  차단 후에는 서로의 포스트를 볼 수 없으며,
                  <br />
                  <span className="text-red-600 dark:text-red-400 font-medium">메시지 수신이 영구적으로 차단됩니다.</span>
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  * 차단 목록에서 언제든지 해제할 수 있습니다.
                </p>
              </div>

              {/* Input Area */}
              <div className="mt-5">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-transparent
                    placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none transition-all"
                  placeholder="차단 사유를 입력하세요 (선택)"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isBlocking}
                className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isBlocking}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-md shadow-sm transition-all flex items-center gap-2"
              >
                {isBlocking ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    처리 중
                  </>
                ) : (
                  '차단하기'
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
