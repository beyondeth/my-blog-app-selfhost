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

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  /**
   * Tailwind classes for the confirm button text color.
   * Default is blue for standard confirmation.
   * Pass 'text-red-600' etc for destructive actions.
   */
  confirmButtonClassName?: string;
  /**
   * Text to display when isLoading is true.
   * Default is "처리중..."
   */
  loadingText?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "계속하기",
  cancelText = "취소",
  isLoading = false,
  confirmButtonClassName = "!text-blue-600 dark:!text-blue-400",
  loadingText = "처리중...",
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="sm:max-w-[340px] p-0 gap-0 bg-white dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-300 dark:border-gray-600">
        <div className="px-6 py-10 text-center">
          <AlertDialogTitle className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </AlertDialogDescription>
        </div>

        <div className="h-px bg-gray-200 dark:bg-gray-700" />

        <div className="flex">
          <AlertDialogCancel asChild>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-6 text-base font-medium text-gray-900 dark:text-white disabled:opacity-50 !bg-transparent !hover:bg-transparent hover:text-gray-900 dark:hover:text-white focus:outline-none focus:bg-transparent !rounded-none !border-0 !m-0 shadow-none ring-0"
            >
              {cancelText}
            </button>
          </AlertDialogCancel>

          <div className="w-px bg-gray-200 dark:bg-gray-700" />

          <AlertDialogAction asChild>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 py-6 text-base font-semibold disabled:opacity-50 !bg-transparent !hover:bg-transparent focus:outline-none focus:bg-transparent !rounded-none !border-0 !m-0 shadow-none ring-0 ${confirmButtonClassName}`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {loadingText}
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
