/**
 * Mixpanel Analytics 초기화 및 추적 유틸리티
 *
 * 사용법:
 * import { mixpanel } from '@/lib/mixpanel';
 * mixpanel.track('Event Name', { property: 'value' });
 */

import mixpanelBrowser from 'mixpanel-browser';

// 초기화 상태 관리
let isInitialized = false;
let initPromise: Promise<void> | null = null;

// 이벤트 큐 (초기화 전 이벤트들을 임시 저장)
interface QueuedEvent {
  eventName: string;
  properties?: Record<string, any>;
  timestamp: number;
}

const eventQueue: QueuedEvent[] = [];

/**
 * Mixpanel 초기화 (Promise 기반)
 * - 클라이언트 사이드에서만 실행됨
 * - 토큰이 없으면 초기화하지 않음 (개발 환경 대응)
 * @returns 초기화 Promise
 */
export const initMixpanel = (): Promise<void> => {
  if (typeof window === 'undefined') {
    return Promise.resolve(); // 서버 사이드에서는 실행하지 않음
  }

  if (isInitialized) {
    return Promise.resolve(); // 이미 초기화됨
  }

  if (initPromise) {
    return initPromise; // 초기화 진행 중이면 기존 Promise 반환
  }

  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

  if (!token) {
    console.warn('⚠️  Mixpanel token이 설정되지 않았습니다. 환경변수 NEXT_PUBLIC_MIXPANEL_TOKEN을 추가하세요.');
    isInitialized = true; // 초기화 실패 처리 방지를 위해 true로 설정
    return Promise.resolve();
  }

  initPromise = new Promise((resolve) => {
    try {
      mixpanelBrowser.init(token, {
        debug: process.env.NODE_ENV === 'development',
        track_pageview: true, // 자동 페이지뷰 추적
        persistence: 'localStorage', // 사용자 ID 저장 위치
        ignore_dnt: false, // Do Not Track 존중
      });

      isInitialized = true;
      console.log('📊 Mixpanel initialized');

      // 큐에 있던 이벤트들 처리
      if (eventQueue.length > 0) {
        console.log(`📊 Processing ${eventQueue.length} queued events`);
        eventQueue.forEach(({ eventName, properties, timestamp }) => {
          const delay = Date.now() - timestamp;
          if (process.env.NODE_ENV === 'development' && delay > 100) {
            console.log(`⚠️ Event "${eventName}" was delayed by ${delay}ms`);
          }
          mixpanelBrowser.track(eventName, properties);
        });
        // 큐 비우기
        eventQueue.length = 0;
      }

      resolve();
    } catch (error) {
      console.error('📊 Mixpanel initialization failed:', error);
      // 실패해도 큐에 있는 이벤트들이 계속 쌓이지 않도록 처리
      eventQueue.length = 0;
      resolve(); // 실패해도 Promise는 resolve하여 앱이 멈추지 않음
    }
  });

  return initPromise;
};

/**
 * 초기화 상태 확인
 */
export const isMixpanelInitialized = (): boolean => isInitialized;

/**
 * 초기화 대기
 */
export const waitForInitialization = (): Promise<void> => {
  if (isInitialized) {
    return Promise.resolve();
  }
  return initMixpanel();
};

/**
 * Mixpanel 이벤트 추적 래퍼
 */
export const mixpanel = {
  /**
   * 이벤트 추적 (큐 지원)
   * @param eventName 이벤트 이름 (예: 'Post Created', 'User Signup')
   * @param properties 이벤트 속성
   */
  track: (eventName: string, properties?: Record<string, any>) => {
    if (isInitialized) {
      // 이미 초기화됨: 바로 추적
      mixpanelBrowser.track(eventName, properties);
    } else {
      // 초기화 안됨: 큐에 추가
      eventQueue.push({
        eventName,
        properties,
        timestamp: Date.now()
      });

      // 초기화 시도 (비동기)
      initMixpanel().catch(error => {
        console.error('Failed to initialize Mixpanel for queued event:', error);
      });
    }
  },

  /**
   * 사용자 식별 (비동기)
   * @param userId 사용자 고유 ID
   */
  identify: async (userId: string) => {
    await waitForInitialization();
    if (isInitialized) {
      mixpanelBrowser.identify(userId);
    }
  },

  /**
   * 사용자 속성 설정 (비동기)
   * @param properties 사용자 속성 (예: { name: 'John', email: 'john@example.com' })
   */
  people: {
    set: async (properties: Record<string, any>) => {
      await waitForInitialization();
      if (isInitialized) {
        mixpanelBrowser.people.set(properties);
      }
    },

    /**
     * 숫자 속성 증가 (비동기)
     * @param property 속성 이름
     * @param value 증가할 값 (기본값: 1)
     */
    increment: async (property: string, value: number = 1) => {
      await waitForInitialization();
      if (isInitialized) {
        mixpanelBrowser.people.increment(property, value);
      }
    },
  },

  /**
   * 페이지뷰 추적 (비동기)
   * @param pageName 페이지 이름
   */
  trackPageView: async (pageName?: string) => {
    await waitForInitialization();
    if (isInitialized) {
      mixpanelBrowser.track_pageview(pageName ? { page: pageName } : undefined);
    }
  },

  /**
   * 사용자 로그아웃 (세션 초기화) (비동기)
   */
  reset: async () => {
    await waitForInitialization();
    if (isInitialized) {
      mixpanelBrowser.reset();
    }
  },

  /**
   * 타이밍 이벤트 시작 (비동기)
   * @param eventName 이벤트 이름
   */
  timeEvent: async (eventName: string) => {
    await waitForInitialization();
    if (isInitialized) {
      mixpanelBrowser.time_event(eventName);
    }
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
