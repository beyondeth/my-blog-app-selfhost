import { useState, useEffect, useCallback } from 'react';

interface WindowSize {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

/**
 * Custom hook for responsive window size detection
 * SSR-safe and with automatic cleanup
 * @returns {WindowSize} Current window dimensions and device type
 */
export function useWindowSize(): WindowSize {
  // SSR-safe initial state
  const [windowSize, setWindowSize] = useState<WindowSize>(() => {
    // Return default values for SSR
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true,
      };
    }

    // Client-side initial values
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isMobile: window.innerWidth < 768,
      isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
      isDesktop: window.innerWidth >= 1024,
    };
  });

  const handleResize = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    setWindowSize({
      width,
      height,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
    });
  }, []);

  useEffect(() => {
    // Skip effect on SSR
    if (typeof window === 'undefined') return;

    // Set initial size
    handleResize();

    // Debounced resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, 150);
    };

    window.addEventListener('resize', debouncedResize);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', debouncedResize);
    };
  }, [handleResize]);

  return windowSize;
}

/**
 * Hook to check if running on mobile device
 * @returns {boolean} True if mobile device
 */
export function useIsMobile(): boolean {
  const { isMobile } = useWindowSize();
  return isMobile;
}

/**
 * Hook to check if running on tablet device
 * @returns {boolean} True if tablet device
 */
export function useIsTablet(): boolean {
  const { isTablet } = useWindowSize();
  return isTablet;
}

/**
 * Hook to check if running on desktop device
 * @returns {boolean} True if desktop device
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useWindowSize();
  return isDesktop;
}