'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw } from 'lucide-react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { useMobileOverlayReset } from '@/hooks/useMobileOverlayReset';

interface ModalProps {
  type: 'image' | 'mermaid';
  content: string; // image는 src URL, mermaid는 SVG string
  alt?: string;
  title?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * 통합 모달 컴포넌트
 *
 * 기능:
 * - 이미지와 Mermaid 다이어그램 모두 지원
 * - react-zoom-pan-pinch로 통합된 zoom/pan 기능
 * - 마우스 휠로 확대/축소
 * - 드래그로 이동
 * - 더블클릭으로 리셋
 * - ESC 키로 닫기
 * - Portal 렌더링: React Portal로 body에 렌더링
 *
 * UI 디자인:
 * - MermaidModal의 깔끔한 카드형 디자인 채택
 * - 상단 고정 툴바로 일관된 컨트롤
 * - 하단 안내 텍스트로 사용법 표시
 */
export default function Modal({
  type,
  content,
  alt = "콘텐츠",
  title,
  isOpen,
  onClose
}: ModalProps) {
  // react-zoom-pan-pinch ref
  const transformComponentRef = useRef<ReactZoomPanPinchRef>(null);
  const handleOverlayReset = useCallback(() => {
    if (isOpen) {
      onClose();
    }
  }, [isOpen, onClose]);

  useMobileOverlayReset(handleOverlayReset, isOpen);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  // 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      // react-zoom-pan-pinch가 자동으로 초기화 처리
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-[90vw] max-h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 상단 툴바 */}
        <div className="absolute top-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 p-4 flex items-center justify-between z-10">
          <div className="text-sm text-gray-600">
            {type === 'mermaid' ? 'Mermaid 다이어그램' : '이미지'}
          </div>

          {/* 통합된 컨트롤 버튼 (이미지와 Mermaid 모두 사용) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => transformComponentRef.current?.zoomOut()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="축소"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => transformComponentRef.current?.zoomIn()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="확대"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={() => transformComponentRef.current?.resetTransform()}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              title="초기화"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="닫기 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 제목 (선택적) */}
        {title && (
          <div className="absolute top-[68px] left-0 right-0 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-4 py-2 z-10">
            <p className="text-sm text-gray-700 text-center truncate">
              {title}
            </p>
          </div>
        )}

        {/* 통합된 콘텐츠 컨테이너 - react-zoom-pan-pinch */}
        <TransformWrapper
          ref={transformComponentRef}
          initialScale={type === 'mermaid' ? 0.8 : 1}
          minScale={0.3}
          maxScale={5}
          centerOnInit={true}
          wheel={{
            // 휠 감도를 크게 줄임 (0.05 → 0.01)
            step: 0.01,
            // 부드러운 애니메이션
            smoothStep: 0.004,
            // 휠 비활성화 (false = 활성화)
            disabled: false,
            wheelDisabled: false,
            // 터치패드 지원
            touchPadDisabled: false,
            // 활성화 키 설정 (기본: 없음)
            activationKeys: [],
            // 제외 키 설정
            excluded: []
          }}
          doubleClick={{ mode: "reset" }}
          // 중심점 기준 확대/축소
          alignmentAnimation={{
            disabled: false,
            animationType: "linear",
            animationTime: 200
          }}
          // 패닝 설정
          panning={{
            disabled: false,
            velocityDisabled: true,  // 관성 비활성화로 더 정확한 제어
            lockAxisX: false,
            lockAxisY: false,
            allowLeftClickPan: true,
            allowMiddleClickPan: true,
            allowRightClickPan: false,
            wheelPanning: false,
            activationKeys: []
          }}
        >
          <TransformComponent
            wrapperStyle={{
              width: '85vw',
              height: '85vh',
              paddingTop: title ? '100px' : '60px',
            }}
            contentStyle={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {type === 'image' ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={content}
                alt={alt}
                className="max-w-full max-h-full object-contain"
                draggable={false}
              />
            ) : (
              /* Mermaid - 모달에서는 별도 클래스 사용 */
              <div
                className="mermaid-in-modal"
                style={{
                  // 모달 전체 공간을 활용
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </TransformComponent>
        </TransformWrapper>

        {/* 안내 텍스트 */}
        <div className="absolute bottom-4 left-4 text-xs text-gray-500 bg-white/90 px-2 py-1 rounded">
          드래그로 이동 • 스크롤로 확대/축소 • 더블클릭으로 리셋 • ESC로 닫기
        </div>
      </div>
    </div>
  );

  // Portal을 사용하여 body에 렌더링
  return typeof window !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
}
