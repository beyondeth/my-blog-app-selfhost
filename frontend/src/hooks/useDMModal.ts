import { useState, useCallback, useEffect } from 'react';
import { useDMStore } from '@/stores/dmStore';
import { useRouter } from 'next/navigation';

interface UseDMModalReturn {
  isOpen: boolean;
  openModal: (conversationId?: string) => void;
  closeModal: () => void;
  toggleModal: () => void;
  mode: 'modal' | 'page';
  setMode: (mode: 'modal' | 'page') => void;
}

/**
 * Hook for managing DM modal state
 * Handles both modal and page modes
 */
export function useDMModal(): UseDMModalReturn {
  const router = useRouter();
  const {
    isDMModalOpen,
    setDMModalOpen,
    dmViewMode,
    setDMViewMode,
    setActiveConversation,
  } = useDMStore();

  // Open modal with optional conversation
  const openModal = useCallback((conversationId?: string) => {
    if (conversationId) {
      setActiveConversation(conversationId);
    }

    if (dmViewMode === 'page') {
      // Navigate to DM page
      const url = conversationId ? `/dm?conversation=${conversationId}` : '/dm';
      router.push(url);
    } else {
      // Open as modal
      setDMModalOpen(true);
    }
  }, [dmViewMode, router, setActiveConversation, setDMModalOpen]);

  // Close modal
  const closeModal = useCallback(() => {
    setDMModalOpen(false);
    // Optionally clear active conversation
    // setActiveConversation(null);
  }, [setDMModalOpen]);

  // Toggle modal
  const toggleModal = useCallback(() => {
    setDMModalOpen(!isDMModalOpen);
  }, [isDMModalOpen, setDMModalOpen]);

  // Set view mode
  const setMode = useCallback((mode: 'modal' | 'page') => {
    setDMViewMode(mode);
    // If switching to page mode while modal is open, redirect
    if (mode === 'page' && isDMModalOpen) {
      router.push('/dm');
      setDMModalOpen(false);
    }
  }, [isDMModalOpen, router, setDMModalOpen, setDMViewMode]);

  // Handle browser back button for modal
  useEffect(() => {
    const handlePopState = () => {
      if (isDMModalOpen) {
        closeModal();
      }
    };

    if (isDMModalOpen) {
      // Add a history entry when modal opens
      window.history.pushState({ modal: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isDMModalOpen, closeModal]);

  return {
    isOpen: isDMModalOpen,
    openModal,
    closeModal,
    toggleModal,
    mode: dmViewMode,
    setMode,
  };
}