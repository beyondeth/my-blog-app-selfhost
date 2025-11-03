'use client';

import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Maximize2, Minimize2, MessageCircle } from 'lucide-react';
import { useDMStore } from '@/stores/dmStore';
import DMLayout from './DMLayout/DMLayout';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useSocket } from '@/hooks/useSocket';
import { useDMNotifications } from '@/hooks/useDMNotifications';

interface DMModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'modal' | 'fullscreen';
}

/**
 * DM 모달 컴포넌트
 *
 * Production-Safe 설계 원칙:
 * 1. Socket/SSE 연결은 모달이 열렸을 때만 수행 (isOpen === true)
 * 2. 모달 닫힘 → 컴포넌트 언마운트 → useEffect cleanup 자동 실행
 * 3. cleanup에서 소켓 disconnect, 모든 리스너 제거, 타이머 정리
 * 4. 메모리 누수 방지, 불필요한 네트워크 연결 방지
 */
const DMModal: React.FC<DMModalProps> = ({
  isOpen,
  onClose,
  mode = 'modal'
}) => {
  const { isMobile, isDesktop } = useWindowSize();
  const modalRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragStart, setDragStart] = React.useState({ x: 0, y: 0 });
  const [skipTransition, setSkipTransition] = React.useState(false);

  /**
   * 핵심: Socket & SSE 연결 (모달이 열렸을 때만)
   *
   * isOpen === true: 연결 시작
   * isOpen === false: 컴포넌트 언마운트 → useEffect cleanup 자동 실행
   *
   * 이 방식으로 완벽한 리소스 정리 보장
   */
  const socket = useSocket(isOpen);
  const { isSSEConnected } = useDMNotifications(isOpen);

  // ESC key handler removed - modal should not close on ESC

  // Handle outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;

    // Portal로 렌더링된 모달들(신고, 차단 등)을 클릭한 경우 무시
    if (target.closest('[data-portal-modal]')) {
      return;
    }

    if (modalRef.current && !modalRef.current.contains(target) && !isFullscreen) {
      onClose();
    }
  }, [onClose, isFullscreen]);

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsAnimating(true);
    setIsFullscreen(!isFullscreen);
    setIsMinimized(false);
    setTimeout(() => setIsAnimating(false), 300);
  };

  // Toggle minimize - 애니메이션 완전 제거
  const toggleMinimize = () => {
    setSkipTransition(true);
    setIsMinimized(!isMinimized);
    // 다음 프레임에서 skipTransition 리셋
    requestAnimationFrame(() => {
      setTimeout(() => setSkipTransition(false), 0);
    });
  };

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Only allow dragging from the header bar
    if (isFullscreen || isMobile) return;

    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault();
  }, [isFullscreen, isMobile, position]);

  // Handle drag
  const handleDrag = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;

    // Keep modal within viewport bounds
    const maxX = window.innerWidth - 900;
    const maxY = window.innerHeight - 600;

    setPosition({
      x: Math.max(-450, Math.min(maxX / 2, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    });
  }, [isDragging, dragStart]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove event listeners
  useEffect(() => {
    if (isOpen) {
      // Small delay for animation
      setTimeout(() => setIsVisible(true), 10);
      document.addEventListener('mousedown', handleOutsideClick);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      setIsVisible(false);
      setPosition({ x: 0, y: 0 }); // Reset position when closing
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleOutsideClick]);

  // Drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDrag);
      document.addEventListener('mouseup', handleDragEnd);
      // Disable text selection while dragging
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleDrag);
      document.removeEventListener('mouseup', handleDragEnd);
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleDrag, handleDragEnd]);

  // Don't render if not open
  if (!isOpen) return null;

  // Modal content
  const modalContent = (
    <div
      className={`
        fixed inset-0 z-[9999]
        flex items-center justify-center
        transition-all duration-300 ease-in-out
        ${isVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
      `}
    >
      {/* Backdrop - 블러 효과 제거, 최소화 시 숨김 */}
      {!isMinimized && (
        <div
          className={`
            absolute inset-0
            ${isFullscreen ? 'bg-white dark:bg-gray-900' : 'bg-black/30'}
            transition-all duration-300 ease-in-out
            ${isVisible ? 'opacity-100' : 'opacity-0'}
          `}
          onClick={!isFullscreen ? onClose : undefined}
        />
      )}

      {/* Modal Container */}
      <div
        ref={modalRef}
        className={`
          ${isFullscreen ? 'fixed inset-0' : isMinimized ? 'fixed' : 'relative'}
          bg-white dark:bg-gray-800
          overflow-hidden
          ${skipTransition || isMinimized || isDragging ? 'transition-none' : 'transition-all duration-300 ease-out'}
          ${isVisible && !isDragging && !isMinimized && !skipTransition ? 'scale-100 opacity-100' : ''}
          ${!isVisible && !isMinimized && !skipTransition ? 'translate-y-8 scale-90 opacity-0' : ''}
          ${isAnimating && !isMinimized && !skipTransition ? 'scale-98' : ''}
          ${isFullscreen
            ? 'w-screen h-screen rounded-none shadow-none'
            : isMobile
              ? 'w-full h-full rounded-none shadow-none'
              : isMinimized
                ? 'w-14 h-14 rounded-full dm-modal-shadow hover:scale-110 cursor-pointer'
                : 'w-full max-w-[900px] mx-4 h-[600px] max-h-[calc(100vh-32px)] rounded-xl dm-modal-shadow'
          }
          ${!isFullscreen && isDesktop && !isMinimized ? 'ring-1 ring-black/5' : ''}
          ${isDragging ? 'cursor-move' : ''}
        `}
        style={{
          ...((!isFullscreen && isDesktop) ? (
            isMinimized
              ? { bottom: '24px', right: '24px', transform: 'none' }
              : { transform: `translate(${position.x}px, ${position.y}px)` }
          ) : {}),
          // 스크롤 독립성: 모달 내 스크롤이 뒷배경에 전파되지 않도록
          overscrollBehavior: 'contain'
        }}
      >
        {/* macOS-style Header Bar - 데스크톱에서만 표시, 최소화 시 숨김 */}
        {isDesktop && !isMinimized && (
          <div
            className="absolute top-0 left-0 right-0 z-10 h-[38px] bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-xl flex items-center justify-between px-4 select-none"
            onMouseDown={handleDragStart}
            style={{ cursor: isFullscreen ? 'default' : 'move' }}
          >
            {/* Traffic Light Buttons */}
            <div className="flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full traffic-light-close hover:brightness-95 transition-all group relative"
                aria-label="Close"
              >
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X className="w-2 h-2 text-red-900/60" strokeWidth={3} />
                </span>
              </button>
              <button
                onClick={toggleMinimize}
                className="w-3 h-3 rounded-full traffic-light-minimize hover:brightness-95 transition-all group relative"
                aria-label="Minimize"
              >
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="block w-2 h-[2px] bg-yellow-900/60 rounded-full" />
                </span>
              </button>
              <button
                onClick={toggleFullscreen}
                className="w-3 h-3 rounded-full traffic-light-maximize hover:brightness-95 transition-all group relative"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              >
                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {isFullscreen ? (
                    <Minimize2 className="w-2 h-2 text-green-900/60" strokeWidth={3} />
                  ) : (
                    <Maximize2 className="w-2 h-2 text-green-900/60" strokeWidth={3} />
                  )}
                </span>
              </button>
            </div>

            {/* Title */}
            <div className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Messages
            </div>

            {/* Empty space for balance */}
            <div className="w-[52px]" />
          </div>
        )}

        {/* DM Layout */}
        <div className={`${isDesktop ? 'h-[calc(100%-38px)] mt-[38px]' : 'h-full'} ${isMinimized ? 'hidden' : ''}`}>
          <DMLayout isModal={true} />
        </div>

        {/* Minimized View - 채팅 아이콘 버튼 (데스크톱에서만 표시) */}
        {isMinimized && isDesktop && (
          <button
            onClick={toggleMinimize}
            className="flex items-center justify-center h-full w-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-full transition-all shadow-lg"
            aria-label="채팅 펼치기"
          >
            <MessageCircle className="w-6 h-6 text-white" strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );

  // Use portal to render modal at root level
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return null;
};

export default DMModal;