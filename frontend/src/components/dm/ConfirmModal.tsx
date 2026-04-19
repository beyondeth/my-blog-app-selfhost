'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="
        relative
        bg-white
        rounded-lg
        shadow-xl
        max-w-md
        w-full
        mx-4
        p-6
      ">
        {/* Close button */}
        <button
          onClick={onClose}
          className="
            absolute
            top-4
            right-4
            p-1
            rounded-lg
            hover:bg-gray-100
            transition-colors
          "
          disabled={isLoading}
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>

        {/* Content */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            {title}
          </h3>
          <p className="text-gray-600">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="
              px-4
              py-2
              text-gray-700
              bg-gray-100
              hover:bg-gray-200
              rounded-lg
              font-medium
              transition-colors
              disabled:opacity-50
              disabled:cursor-not-allowed
            "
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="
              px-4
              py-2
              text-white
              bg-red-500
              hover:bg-red-600
              rounded-lg
              font-medium
              transition-colors
              disabled:opacity-50
              disabled:cursor-not-allowed
              flex
              items-center
              gap-2
            "
          >
            {isLoading && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
