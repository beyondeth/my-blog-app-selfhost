"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { FiAlertCircle, FiX } from 'react-icons/fi';

interface BlockConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
  username?: string;
  isBlocking?: boolean;
}

/**
 * 사용자 차단 확인 모달
 * 차단 효과를 안내하고 확인을 받는 컴포넌트
 */
export default function BlockConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  username,
  isBlocking = false,
}: BlockConfirmModalProps) {
  const [reason, setReason] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 성공 시 1.5초 후 자동으로 모달 닫기
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onClose();
        // 모달이 닫힌 후 상태 초기화
        setTimeout(() => {
          setIsSuccess(false);
          setReason('');
        }, 300);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, onClose]);

  const handleConfirm = async () => {
    try {
      await onConfirm(reason || undefined);
      setIsSuccess(true); // 성공 상태로 전환
    } catch (error) {
      // 에러는 useBlock hook에서 처리됨
    }
  };

  // Don't render if not open or not mounted
  if (!isOpen || !mounted) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center"
      onClick={(e) => e.stopPropagation()}
      data-portal-modal="block"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6 z-[10001]"
        onClick={(e) => e.stopPropagation()}
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
              사용자를 차단했습니다
            </h3>
            <p className="text-sm text-gray-600">
              {username && `${username}님과의 대화가 숨겨집니다`}
            </p>
          </div>
        ) : (
          /* Confirm Screen */
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold">사용자 차단</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Username */}
            {username && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">차단할 사용자:</p>
                <p className="text-sm font-medium text-gray-900">{username}</p>
              </div>
            )}

            {/* 차단 효과 안내 */}
            <div className="mb-6 p-4 bg-red-50 rounded-lg">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                차단 시 다음 효과가 적용됩니다
              </h3>
              <ul className="text-sm text-red-800 space-y-1">
                <li>• 해당 사용자와 메시지를 주고받을 수 없습니다</li>
                <li>• 해당 사용자를 팔로우할 수 없습니다</li>
                <li>• 대화 목록에서 해당 사용자와의 대화가 숨겨집니다</li>
              </ul>
            </div>

            {/* 차단 사유 (선택사항) */}
            <div className="mb-6">
              <label htmlFor="block-reason" className="block text-sm font-medium text-gray-700 mb-2">
                차단 사유 (선택사항)
              </label>
              <textarea
                id="block-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                placeholder="차단 사유를 입력해주세요..."
              />
              <p className="mt-1 text-xs text-gray-500">
                {reason.length}/500
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isBlocking}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isBlocking}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isBlocking ? '차단 중...' : '차단하기'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
