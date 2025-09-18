'use client';

import React from 'react';
import DMModal from './DMModal';
import { useDMModal } from '@/hooks/useDMModal';
import { useDMNotifications } from '@/hooks/useDMNotifications';

/**
 * Provider component that manages DM modal state
 * Should be placed at app root level
 */
export const DMModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isOpen, closeModal } = useDMModal();

  // SSE notifications for idle connection recovery
  const { isSSEConnected } = useDMNotifications();

  return (
    <>
      {children}
      <DMModal isOpen={isOpen} onClose={closeModal} />
    </>
  );
};