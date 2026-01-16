"use client";

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ReportReason, reportReasonLabels } from '@/hooks/useReport';
import { FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import { useMobileOverlayReset } from '@/hooks/useMobileOverlayReset';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: ReportReason, description?: string) => Promise<void>;
  targetTitle?: string;
  targetType: 'post' | 'comment' | 'user';
  isSubmitting?: boolean;
}

/**
 * 콘텐츠 신고 모달 (Redesign - Portal Version)
 * Premium Aesthetic: Modern Grid Layout, Dark Mode Support
 */
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

  useMobileOverlayReset(onClose, isOpen);

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
    if (isSubmitting || !selectedReason) return;

    try {
      await onSubmit(selectedReason, description || undefined);
      setIsSuccess(true);
    } catch (error) {
       // 에러는 useReport hook에서 처리됨
    }
  };

  const getTargetTypeLabel = () => {
    switch (targetType) {
      case 'post': return '게시글';
      case 'comment': return '댓글';
      case 'user': return '사용자';
      default: return '콘텐츠';
    }
  };

  // Don't render if not open or not mounted
  if (!isOpen || !mounted) {
    return null;
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 sm:p-6"
      onClick={(e) => e.stopPropagation()}
      data-portal-modal="report"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Modal Window */}
      <div
        className="relative w-full max-w-[500px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {isSuccess ? (
           /* Success Screen */
           <div className="flex flex-col items-center justify-center py-16 px-6">
             <div className="w-16 h-16 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center mb-6">
               <FiCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
             </div>
             <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
               신고가 접수되었습니다
             </h3>
             <p className="text-sm text-zinc-500 dark:text-zinc-400">
               검토 후 적절한 조치를 취하겠습니다.
             </p>
           </div>
        ) : (
          /* Report Form */
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-2 shrink-0">
               <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                  <FiAlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {getTargetTypeLabel()} 신고
                  </h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
                    커뮤니티 가이드라인을 위반하는 콘텐츠를 신고해주세요.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-1"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
             <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
               <form id="report-form-portal" onSubmit={handleSubmit} className="space-y-6">
                 {/* Check Target */}
                 {targetTitle && (
                    <div className="px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800">
                      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">
                         <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                         신고 대상
                      </div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200 truncate pl-3.5">
                        {targetTitle}
                      </p>
                    </div>
                 )}

                 {/* Reason Grid */}
                 <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                      신고 사유 <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      {Object.entries(reportReasonLabels).map(([value, label]) => (
                        <label
                          key={value}
                          className={`
                            relative flex items-center p-3 rounded-xl border cursor-pointer transition-all duration-200 group
                            ${selectedReason === value
                              ? 'bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800 shadow-sm'
                              : 'bg-white dark:bg-zinc-800/30 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                            }
                          `}
                          onClick={(e) => {
                            e.preventDefault();
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
                          <div className={`
                            w-4 h-4 rounded-full border flex items-center justify-center mr-2.5 transition-colors
                             ${selectedReason === value
                                ? 'border-red-500 bg-red-500'
                                : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400'
                             }
                          `}>
                            {selectedReason === value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                          <span className={`text-sm font-medium ${selectedReason === value ? 'text-red-900 dark:text-red-100' : 'text-zinc-600 dark:text-zinc-300'}`}>
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                 </div>

                 {/* Description */}
                 <div>
                   <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                     추가 설명 <span className="text-zinc-400 font-normal ml-1">(선택)</span>
                   </label>
                   <textarea
                     value={description}
                     onChange={(e) => setDescription(e.target.value)}
                     rows={3}
                     maxLength={1000}
                     className="w-full px-3 py-2 text-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg 
                       focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-transparent
                       placeholder:text-zinc-400 dark:placeholder:text-zinc-600 resize-none transition-all"
                     placeholder="상세 내용을 입력하시면 검토에 도움이 됩니다."
                   />
                   <div className="flex justify-end mt-1.5">
                     <span className="text-xs text-zinc-400 dark:text-zinc-500">
                       {description.length}/1000
                     </span>
                   </div>
                 </div>
               </form>
             </div>

             {/* Footer */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center shrink-0">
               <p className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
                  <FiAlertTriangle className="w-3 h-3" />
                  허위 신고는 제재 대상이 될 수 있습니다.
               </p>
               <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md transition-colors"
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    form="report-form-portal"
                    disabled={!selectedReason || isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-md shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? '처리 중...' : '신고하기'}
                  </button>
               </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
