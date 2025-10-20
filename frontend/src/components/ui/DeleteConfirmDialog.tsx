"use client";

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  itemName?: string;
}

export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "게시물을 삭제하시겠어요?",
  description,
  confirmText = "삭제",
  cancelText = "취소",
  isLoading = false,
  itemName = "항목"
}: DeleteConfirmDialogProps) {
  const defaultDescription = "이 게시물을 삭제하면 복원할 수 없습니다.";

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[340px] p-0 gap-0 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-300 dark:border-gray-600">
        {/* 헤더 영역 */}
        <div className="px-6 py-10 text-center">
          <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {description || defaultDescription}
          </AlertDialogDescription>
        </div>

        {/* 구분선 */}
        <div className="h-px bg-gray-200 dark:bg-gray-700" />

        {/* 버튼 영역 - iOS 스타일 */}
        <div className="flex">
          {/* 취소 버튼 */}
          <AlertDialogCancel asChild>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-6 text-base font-medium text-gray-900 dark:text-white disabled:opacity-50 bg-transparent hover:bg-transparent hover:text-gray-900 dark:hover:text-white focus:outline-none focus:bg-transparent"
            >
              {cancelText}
            </button>
          </AlertDialogCancel>

          {/* 세로 구분선 */}
          <div className="w-px bg-gray-200 dark:bg-gray-700" />

          {/* 삭제 버튼 */}
          <AlertDialogAction asChild>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              autoFocus
              className="flex-1 py-6 text-base font-semibold text-red-600 dark:text-red-500 disabled:opacity-50 bg-transparent hover:bg-transparent focus:outline-none focus:bg-transparent"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-red-600 dark:border-red-500 border-t-transparent" />
                  삭제중...
                </span>
              ) : (
                confirmText
              )}
            </button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
