"use client";

import React from 'react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "게시물을 삭제하시겠어요?",
  description = "이 게시물을 삭제하면 복원할 수 없습니다.",
  confirmText = "삭제",
  cancelText = "취소",
  isLoading = false,
}: DeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmText={confirmText}
      cancelText={cancelText}
      isLoading={isLoading}
      confirmButtonClassName="text-red-600 dark:text-red-500"
      loadingText="삭제중..."
    />
  );
}
