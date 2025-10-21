"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReportReason, reportReasonLabels } from '@/hooks/useReport';
import { FiAlertCircle, FiX } from 'react-icons/fi';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description?: string) => Promise<void>;
  targetTitle?: string;
  targetType: 'post' | 'comment' | 'user';
  isSubmitting?: boolean;
}

export default function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  targetTitle,
  targetType,
  isSubmitting = false,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
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
          setSelectedReason(null);
          setDescription('');
        }, 300);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;

    try {
      await onSubmit(selectedReason, description || undefined);
      setIsSuccess(true); // 성공 상태로 전환
    } catch (error) {
      // 에러는 useReport hook에서 처리됨
    }
  };

  const getTargetTypeLabel = () => {
    switch (targetType) {
      case 'post':
        return '게시글';
      case 'comment':
        return '댓글';
      case 'user':
        return '사용자';
      default:
        return '콘텐츠';
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
      data-portal-modal="report"
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
              신고가 접수되었습니다
            </h3>
            <p className="text-sm text-gray-600">
              검토 후 조치하겠습니다
            </p>
          </div>
        ) : (
          /* Report Form */
          <>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <FiAlertCircle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold">신고하기</h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Target Title */}
            {targetTitle && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">신고 대상:</p>
                <p className="text-sm font-medium text-gray-900 truncate">{targetTitle}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
          {/* Reason Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              신고 사유를 선택해주세요
            </label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(reportReasonLabels).map(([value, label]) => (
                <label
                  key={value}
                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedReason === value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    // 같은 항목을 다시 클릭하면 선택 해제
                    setSelectedReason(selectedReason === value ? null : value as ReportReason);
                  }}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={selectedReason === value}
                    onChange={() => {}}
                    className="sr-only"
                  />
                  {/* Custom checkbox */}
                  <div
                    className={`w-5 h-5 mr-2 border-2 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                      selectedReason === value
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {selectedReason === value && (
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              추가 설명 (선택사항)
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="신고 사유에 대한 추가 설명을 입력해주세요..."
            />
            <p className="mt-1 text-xs text-gray-500">
              {description.length}/1000
            </p>
          </div>

          {/* Notice */}
          <div className="mb-6 p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              허위 신고는 제재 대상이 될 수 있습니다. 신중하게 신고해주세요.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!selectedReason || isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '신고 중...' : '신고하기'}
            </button>
          </div>
        </form>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
