'use client';

import React from 'react';
import DMModal from './DMModal';
import { useDMModal } from '@/hooks/useDMModal';

/**
 * Provider component that manages DM modal state
 * Should be placed at app root level
 *
 * 설계 원칙 (Production-Safe):
 * - Root Level에서는 UI 상태 관리만 수행
 * - Socket/SSE 연결은 실제 채팅 컴포넌트(DMModal)에서만 관리
 * - 불필요한 네트워크 연결 방지 → 성능 최적화 & 에러 방지
 */
export const DMModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOpen, closeModal } = useDMModal();

  return (
    <>
      {children}
      <DMModal isOpen={isOpen} onClose={closeModal} />
    </>
  );
};