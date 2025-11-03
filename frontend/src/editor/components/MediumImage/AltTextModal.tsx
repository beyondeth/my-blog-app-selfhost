"use client";

/**
 * Alt Text Modal
 * 이미지 대체 텍스트(Alt text) 입력 모달
 *
 * Alt text의 목적:
 * 1. 접근성: 시각 장애인용 스크린 리더
 * 2. SEO: 검색 엔진 최적화
 * 3. 이미지 로드 실패 시 대체 텍스트 표시
 */

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// ============================================
// 타입 정의 (Type Definitions)
// ============================================
interface AltTextModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (alt: string) => void;
}

// ============================================
// 메인 컴포넌트 (Main Component)
// ============================================
export const AltTextModal: React.FC<AltTextModalProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
}) => {
  const [tempValue, setTempValue] = useState(value);

  // value가 변경되면 tempValue 업데이트
  useEffect(() => {
    setTempValue(value);
  }, [value]);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // 저장 핸들러
  const handleSave = () => {
    onChange(tempValue);
    onClose();
  };

  // 모달이 닫혀있으면 렌더링하지 않음
  if (!isOpen) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        {/* 모달 컨텐츠 */}
        <div
          className={cn(
            'alt-text-modal',
            'bg-white rounded-lg shadow-2xl',
            'w-full max-w-md mx-4',
            'p-6'
          )}
          onClick={(e) => e.stopPropagation()} // 모달 클릭 시 닫히지 않도록
        >
          {/* 헤더 */}
          <div className="modal-header mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Alt text 설정
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              이미지를 설명하는 대체 텍스트를 입력하세요 (접근성 및 SEO)
            </p>
          </div>

          {/* 입력 필드 */}
          <div className="modal-body mb-6">
            <textarea
              value={tempValue}
              onChange={(e) => setTempValue(e.target.value)}
              placeholder="예: 파란 하늘을 배경으로 한 산 풍경"
              className={cn(
                'w-full h-24 px-3 py-2',
                'border border-gray-300 rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
                'resize-none',
                'text-sm text-gray-700',
                'placeholder:text-gray-400'
              )}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              💡 팁: 구체적이고 간결하게 작성하세요 (최대 125자 권장)
            </p>
          </div>

          {/* 버튼 그룹 */}
          <div className="modal-footer flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-md',
                'text-sm font-medium text-gray-700',
                'bg-gray-100 hover:bg-gray-200',
                'transition-colors'
              )}
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={cn(
                'px-4 py-2 rounded-md',
                'text-sm font-medium text-white',
                'bg-emerald-600 hover:bg-emerald-700',
                'transition-colors'
              )}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
