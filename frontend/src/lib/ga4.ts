/**
 * Google Analytics 4 (GA4) 유틸리티
 *
 * 사용법:
 * import { ga4 } from '@/lib/ga4';
 *
 * // 커스텀 이벤트 추적
 * ga4.event('button_click', { button_name: 'subscribe' });
 *
 * // 페이지뷰 추적 (자동으로 추적되지만 SPA에서 수동 추적 필요 시)
 * ga4.pageview('/blog/my-post');
 *
 * // 사용자 속성 설정
 * ga4.setUserProperties({ user_id: '12345', plan: 'premium' });
 */

// gtag 함수 타입 정의
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * GA4 이벤트 추적
 * @param eventName - 이벤트 이름 (snake_case 권장)
 * @param params - 이벤트 파라미터
 */
const event = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};

/**
 * 페이지뷰 추적 (SPA에서 라우트 변경 시 사용)
 * @param url - 페이지 URL
 * @param title - 페이지 제목 (선택)
 */
const pageview = (url: string, title?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      page_path: url,
      page_title: title,
    });
  }
};

/**
 * 사용자 속성 설정
 * @param properties - 사용자 속성 객체
 */
const setUserProperties = (properties: Record<string, any>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', properties);
  }
};

/**
 * 사용자 ID 설정
 * @param userId - 사용자 ID
 */
const setUserId = (userId: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID, {
      user_id: userId,
    });
  }
};

/**
 * 전환 이벤트 추적 (구매, 회원가입 등)
 * @param conversionId - 전환 ID (Google Ads)
 * @param value - 전환 가치
 * @param currency - 통화 (기본값: USD)
 */
const conversion = (conversionId: string, value?: number, currency: string = 'USD') => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'conversion', {
      send_to: conversionId,
      value: value,
      currency: currency,
    });
  }
};

/**
 * GA4 유틸리티 객체
 */
export const ga4 = {
  event,
  pageview,
  setUserProperties,
  setUserId,
  conversion,
};

/**
 * 일반적인 이벤트 타입 (선택적 사용)
 */
export const GA4Events = {
  // 사용자 행동
  LOGIN: 'login',
  SIGN_UP: 'sign_up',
  SEARCH: 'search',

  // 콘텐츠 인터랙션
  SELECT_CONTENT: 'select_content',
  SHARE: 'share',

  // E-commerce
  ADD_TO_CART: 'add_to_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  PURCHASE: 'purchase',

  // 커스텀 이벤트 (예시)
  POST_VIEWED: 'post_viewed',
  POST_LIKED: 'post_liked',
  COMMENT_CREATED: 'comment_created',
} as const;
