/**
 * Mixpanel Analytics 초기화 및 추적 유틸리티
 *
 * 사용법:
 * import { mixpanel } from '@/lib/mixpanel';
 * mixpanel.track('Event Name', { property: 'value' });
 */

import mixpanelBrowser from 'mixpanel-browser';

// Mixpanel 초기화 여부 확인
let isInitialized = false;

/**
 * Mixpanel 초기화
 * - 클라이언트 사이드에서만 실행됨
 * - 토큰이 없으면 초기화하지 않음 (개발 환경 대응)
 */
export const initMixpanel = () => {
  if (typeof window === 'undefined') {
    return; // 서버 사이드에서는 실행하지 않음
  }

  if (isInitialized) {
    return; // 이미 초기화됨
  }

  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

  if (!token) {
    console.warn('⚠️  Mixpanel token이 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_MIXPANEL_TOKEN을 추가하세요.');
    return;
  }

  mixpanelBrowser.init(token, {
    debug: process.env.NODE_ENV === 'development',
    track_pageview: true, // 자동 페이지뷰 추적
    persistence: 'localStorage', // 사용자 ID 저장 위치
    ignore_dnt: false, // Do Not Track 존중
  });

  isInitialized = true;
  console.log('📊 Mixpanel initialized');
};

/**
 * Mixpanel 이벤트 추적 래퍼
 */
export const mixpanel = {
  /**
   * 이벤트 추적
   * @param eventName 이벤트 이름 (예: 'Post Created', 'User Signup')
   * @param properties 이벤트 속성
   */
  track: (eventName: string, properties?: Record<string, any>) => {
    if (!isInitialized) {
      console.warn(`Mixpanel not initialized. Event "${eventName}" not tracked.`);
      return;
    }
    mixpanelBrowser.track(eventName, properties);
  },

  /**
   * 사용자 식별
   * @param userId 사용자 고유 ID
   */
  identify: (userId: string) => {
    if (!isInitialized) return;
    mixpanelBrowser.identify(userId);
  },

  /**
   * 사용자 속성 설정
   * @param properties 사용자 속성 (예: { name: 'John', email: 'john@example.com' })
   */
  people: {
    set: (properties: Record<string, any>) => {
      if (!isInitialized) return;
      mixpanelBrowser.people.set(properties);
    },

    /**
     * 숫자 속성 증가
     * @param property 속성 이름
     * @param value 증가할 값 (기본값: 1)
     */
    increment: (property: string, value: number = 1) => {
      if (!isInitialized) return;
      mixpanelBrowser.people.increment(property, value);
    },
  },

  /**
   * 페이지뷰 추적
   * @param pageName 페이지 이름
   */
  trackPageView: (pageName?: string) => {
    if (!isInitialized) return;
    mixpanelBrowser.track_pageview(pageName ? { page: pageName } : undefined);
  },

  /**
   * 사용자 로그아웃 (세션 초기화)
   */
  reset: () => {
    if (!isInitialized) return;
    mixpanelBrowser.reset();
  },

  /**
   * 타이밍 이벤트 시작
   * @param eventName 이벤트 이름
   */
  timeEvent: (eventName: string) => {
    if (!isInitialized) return;
    mixpanelBrowser.time_event(eventName);
  },
};

/**
 * 타입 안전한 이벤트 추적
 * (프로젝트에서 사용하는 주요 이벤트들을 타입으로 정의)
 */
export type AnalyticsEvent =
  // 사용자 관련
  | { name: 'User Signup'; properties: { method: 'email' | 'google' | 'github' | 'kakao' } }
  | { name: 'User Login'; properties: { method: 'email' | 'google' | 'github' | 'kakao' } }
  | { name: 'User Logout'; properties?: Record<string, any> }

  // 포스트 관련
  | { name: 'Post Created'; properties: { categoryId?: string; tags?: string[]; wordCount?: number } }
  | { name: 'Post Viewed'; properties: { postId: string; slug: string } }
  | { name: 'Post Liked'; properties: { postId: string } }
  | { name: 'Post Bookmarked'; properties: { postId: string } }
  | { name: 'Post Shared'; properties: { postId: string; platform?: string } }

  // 댓글 관련
  | { name: 'Comment Created'; properties: { postId: string; parentId?: string } }
  | { name: 'Comment Liked'; properties: { commentId: string } }

  // 검색 관련
  | { name: 'Search Performed'; properties: { query: string; resultsCount: number } }

  // DM 관련
  | { name: 'DM Sent'; properties: { receiverId: string } }

  // 설정 관련
  | { name: 'Settings Updated'; properties: { section: string } }
  | { name: 'Theme Changed'; properties: { theme: 'light' | 'dark' } };

/**
 * 타입 안전한 이벤트 추적 함수
 */
export const trackEvent = <T extends AnalyticsEvent>(
  event: T
) => {
  mixpanel.track(event.name, event.properties);
};

// 개발 환경에서 콘솔에 Mixpanel 객체 노출
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).mixpanel = mixpanel;
}
