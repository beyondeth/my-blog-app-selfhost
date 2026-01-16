export const MOBILE_RESET_EVENT = 'app:reset-overlays';

export function isMobileViewport(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }

  return window.matchMedia('(max-width: 768px)').matches;
}

export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
    return true;
  }

  return (navigator.maxTouchPoints || 0) > 0;
}

export function isMobileInteraction(): boolean {
  return isMobileViewport() && isTouchDevice();
}

export function getOutsideClickEvent(): 'touchstart' | 'mousedown' {
  return isMobileInteraction() ? 'touchstart' : 'mousedown';
}
