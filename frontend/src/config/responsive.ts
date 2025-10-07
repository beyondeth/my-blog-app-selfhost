/**
 * 반응형 디자인 설정
 * 디바이스별 해상도, Breakpoint, 유틸리티 정의
 */

/**
 * 디바이스별 해상도 정의
 * 실제 물리 해상도가 아닌 CSS 논리 픽셀 기준 (viewport width x height)
 */
export const DEVICE_RESOLUTIONS = {
  // 모바일 디바이스 (가장 많이 사용되는 5가지)
  mobile: {
    androidBudget: {
      width: 360,
      height: 800,
      name: 'Android 중저가형',
      description: 'Galaxy A 시리즈, 중저가 Android',
    },
    iphoneX: {
      width: 375,
      height: 812,
      name: 'iPhone X~11',
      description: 'iPhone X, XS, 11 Pro 등',
    },
    iphone12: {
      width: 390,
      height: 844,
      name: 'iPhone 12/13/14',
      description: 'iPhone 12, 13, 14 표준 모델',
    },
    androidFlagship: {
      width: 412,
      height: 915,
      name: 'Android 플래그십',
      description: 'Galaxy S 시리즈, Pixel 등',
    },
    iphoneProMax: {
      width: 428,
      height: 926,
      name: 'iPhone Pro Max',
      description: 'iPhone 12/13/14 Pro Max',
    },
  },

  // 태블릿 디바이스
  tablet: {
    ipadMini: {
      width: 744,
      height: 1133,
      name: 'iPad Mini',
      description: 'iPad Mini (세로 모드)',
    },
    ipad: {
      width: 820,
      height: 1180,
      name: 'iPad 10.2"',
      description: 'iPad 10.2" (세로 모드)',
    },
    ipadAir: {
      width: 820,
      height: 1180,
      name: 'iPad Air',
      description: 'iPad Air (세로 모드)',
    },
    ipadPro11: {
      width: 834,
      height: 1194,
      name: 'iPad Pro 11"',
      description: 'iPad Pro 11" (세로 모드)',
    },
    ipadPro129: {
      width: 1024,
      height: 1366,
      name: 'iPad Pro 12.9"',
      description: 'iPad Pro 12.9" (세로 모드)',
    },
    androidTablet: {
      width: 800,
      height: 1280,
      name: 'Android Tablet',
      description: 'Galaxy Tab 등 Android 태블릿',
    },
  },
} as const;

/**
 * Tailwind CSS Breakpoints
 * 모바일 퍼스트 접근 방식 사용
 */
export const BREAKPOINTS = {
  xs: '360px',   // 가장 작은 모바일 (Android 중저가형)
  sm: '375px',   // 표준 모바일 (iPhone X 이후)
  md: '768px',   // 태블릿 세로 모드
  lg: '1024px',  // 태블릿 가로 모드 / 소형 데스크톱
  xl: '1280px',  // 데스크톱
  '2xl': '1536px', // 큰 데스크톱
} as const;

/**
 * Breakpoint를 숫자로 변환한 값 (미디어 쿼리 비교용)
 */
export const BREAKPOINT_VALUES = {
  xs: 360,
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * 디바이스 타입 Enum
 */
export enum DeviceType {
  MOBILE_SMALL = 'mobile-small',      // < 375px (Android 중저가형)
  MOBILE_MEDIUM = 'mobile-medium',    // 375px ~ 768px (대부분의 스마트폰)
  MOBILE_LARGE = 'mobile-large',      // 428px ~ 768px (큰 스마트폰)
  TABLET_PORTRAIT = 'tablet-portrait',   // 768px ~ 1024px (태블릿 세로)
  TABLET_LANDSCAPE = 'tablet-landscape', // 1024px ~ 1280px (태블릿 가로)
  DESKTOP = 'desktop',                // >= 1280px (데스크톱)
}

/**
 * Safe Area Insets (iOS Notch 영역 대응)
 */
export const SAFE_AREA_INSETS = {
  // iOS 홈 인디케이터가 있는 기종 (iPhone X 이후)
  iosWithNotch: {
    top: 44,      // 상단 노치 영역
    bottom: 34,   // 하단 홈 인디케이터
    left: 0,
    right: 0,
  },
  // iOS 홈버튼 기종
  iosWithHomeButton: {
    top: 20,      // 상태바
    bottom: 0,
    left: 0,
    right: 0,
  },
  // Android (제스처 네비게이션)
  androidGesture: {
    top: 24,      // 상태바
    bottom: 20,   // 제스처 바
    left: 0,
    right: 0,
  },
  // Android (3버튼 네비게이션)
  androidButtons: {
    top: 24,      // 상태바
    bottom: 48,   // 네비게이션 바
    left: 0,
    right: 0,
  },
} as const;

/**
 * Container 설정 (디바이스별 최대 너비 및 패딩)
 */
export const CONTAINER_CONFIG = {
  xs: {
    maxWidth: '100%',
    padding: '16px',  // 1rem
  },
  sm: {
    maxWidth: '100%',
    padding: '16px',
  },
  md: {
    maxWidth: '768px',
    padding: '24px',  // 1.5rem
  },
  lg: {
    maxWidth: '1024px',
    padding: '32px',  // 2rem
  },
  xl: {
    maxWidth: '1280px',
    padding: '40px',  // 2.5rem
  },
  '2xl': {
    maxWidth: '1536px',
    padding: '48px',  // 3rem
  },
} as const;

/**
 * 유틸리티 함수: Breakpoint 값을 숫자로 변환
 */
export function getBreakpointValue(breakpoint: keyof typeof BREAKPOINTS): number {
  return BREAKPOINT_VALUES[breakpoint];
}

/**
 * 유틸리티 함수: 현재 화면 너비로 디바이스 타입 판단
 */
export function getDeviceType(width: number): DeviceType {
  if (width < BREAKPOINT_VALUES.sm) {
    return DeviceType.MOBILE_SMALL;
  }
  if (width < BREAKPOINT_VALUES.md) {
    return DeviceType.MOBILE_MEDIUM;
  }
  if (width < BREAKPOINT_VALUES.lg) {
    return DeviceType.TABLET_PORTRAIT;
  }
  if (width < BREAKPOINT_VALUES.xl) {
    return DeviceType.TABLET_LANDSCAPE;
  }
  return DeviceType.DESKTOP;
}

/**
 * 유틸리티 타입: Breakpoint 키
 */
export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * 유틸리티 타입: 디바이스 해상도
 */
export type DeviceResolution = {
  width: number;
  height: number;
  name: string;
  description: string;
};
