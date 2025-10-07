'use client';

import { useState, useEffect } from 'react';
import {
  BREAKPOINT_VALUES,
  DeviceType,
  getDeviceType,
  type BreakpointKey,
} from '@/config/responsive';

/**
 * 반응형 디자인을 위한 커스텀 훅
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isMobile, isTablet, deviceType, width } = useResponsive();
 *
 *   if (isMobile) {
 *     return <MobileLayout />;
 *   }
 *
 *   return <DesktopLayout />;
 * }
 * ```
 */
export function useResponsive() {
  // SSR 대응: 초기값은 null
  const [mounted, setMounted] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    setMounted(true);

    // 초기 화면 크기 설정
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // 초기 실행
    handleResize();

    // 리사이즈 이벤트 리스너 등록
    window.addEventListener('resize', handleResize);

    // 클린업
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // SSR 중이거나 마운트 전에는 기본값 반환
  if (!mounted) {
    return {
      width: 0,
      height: 0,
      isMobile: false,
      isTablet: false,
      isDesktop: false,
      deviceType: DeviceType.DESKTOP,
      isBreakpoint: () => false,
      isAboveBreakpoint: () => false,
      isBelowBreakpoint: () => false,
    };
  }

  const { width, height } = windowSize;
  const deviceType = getDeviceType(width);

  // 디바이스 타입별 플래그
  const isMobile =
    deviceType === DeviceType.MOBILE_SMALL ||
    deviceType === DeviceType.MOBILE_MEDIUM ||
    deviceType === DeviceType.MOBILE_LARGE;

  const isTablet =
    deviceType === DeviceType.TABLET_PORTRAIT ||
    deviceType === DeviceType.TABLET_LANDSCAPE;

  const isDesktop = deviceType === DeviceType.DESKTOP;

  /**
   * 특정 breakpoint와 정확히 일치하는지 확인
   */
  const isBreakpoint = (breakpoint: BreakpointKey): boolean => {
    const value = BREAKPOINT_VALUES[breakpoint];
    const nextBreakpoint = getNextBreakpoint(breakpoint);

    if (!nextBreakpoint) {
      return width >= value;
    }

    const nextValue = BREAKPOINT_VALUES[nextBreakpoint];
    return width >= value && width < nextValue;
  };

  /**
   * 특정 breakpoint 이상인지 확인
   */
  const isAboveBreakpoint = (breakpoint: BreakpointKey): boolean => {
    const value = BREAKPOINT_VALUES[breakpoint];
    return width >= value;
  };

  /**
   * 특정 breakpoint 미만인지 확인
   */
  const isBelowBreakpoint = (breakpoint: BreakpointKey): boolean => {
    const value = BREAKPOINT_VALUES[breakpoint];
    return width < value;
  };

  return {
    width,
    height,
    isMobile,
    isTablet,
    isDesktop,
    deviceType,
    isBreakpoint,
    isAboveBreakpoint,
    isBelowBreakpoint,
  };
}

/**
 * 다음 breakpoint 키를 반환하는 헬퍼 함수
 */
function getNextBreakpoint(current: BreakpointKey): BreakpointKey | null {
  const breakpoints: BreakpointKey[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
  const currentIndex = breakpoints.indexOf(current);

  if (currentIndex === -1 || currentIndex === breakpoints.length - 1) {
    return null;
  }

  return breakpoints[currentIndex + 1];
}

/**
 * 특정 breakpoint에서만 실행되는 effect 훅
 *
 * @example
 * ```tsx
 * useBreakpointEffect('md', () => {
 *   console.log('태블릿 크기입니다');
 * });
 * ```
 */
export function useBreakpointEffect(
  breakpoint: BreakpointKey,
  effect: () => void | (() => void),
  deps: React.DependencyList = []
) {
  const { isBreakpoint } = useResponsive();

  useEffect(() => {
    if (isBreakpoint(breakpoint)) {
      return effect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpoint, isBreakpoint, ...deps]);
}

/**
 * 모바일 여부만 간단하게 체크하는 훅
 *
 * @example
 * ```tsx
 * const isMobile = useIsMobile();
 * ```
 */
export function useIsMobile(): boolean {
  const { isMobile } = useResponsive();
  return isMobile;
}

/**
 * 태블릿 여부만 간단하게 체크하는 훅
 *
 * @example
 * ```tsx
 * const isTablet = useIsTablet();
 * ```
 */
export function useIsTablet(): boolean {
  const { isTablet } = useResponsive();
  return isTablet;
}

/**
 * 데스크톱 여부만 간단하게 체크하는 훅
 *
 * @example
 * ```tsx
 * const isDesktop = useIsDesktop();
 * ```
 */
export function useIsDesktop(): boolean {
  const { isDesktop } = useResponsive();
  return isDesktop;
}
