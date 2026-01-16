'use client';

import { useEffect } from 'react';
import { isMobileInteraction, MOBILE_RESET_EVENT } from '@/utils/interaction';

export function useMobileOverlayReset(onReset: () => void, enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || !isMobileInteraction()) {
      return;
    }

    const handleReset = () => {
      onReset();
    };

    window.addEventListener(MOBILE_RESET_EVENT, handleReset);
    return () => {
      window.removeEventListener(MOBILE_RESET_EVENT, handleReset);
    };
  }, [onReset, enabled]);
}
