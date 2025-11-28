/**
 * 오디오 관련 모듈 내보내기
 *
 * 자동 초기화:
 * - 브라우저 환경에서 모듈 로드 시 AudioManager-Store 동기화 자동 초기화
 * - React 컴포넌트 생명주기와 완전히 독립적으로 동작
 */

export { default as AudioManager, getAudioManager } from './AudioManager';
export type { AudioEventType, AudioEventCallback } from './AudioManager';
export { initAudioStoreSync, isAudioStoreSyncInitialized } from './audioStoreSync';

// ============================================
// 브라우저 환경 자동 초기화
// 모듈 로드 시점에 이벤트 리스너 등록
// ============================================

import { initAudioStoreSync } from './audioStoreSync';

if (typeof window !== 'undefined') {
  // DOM이 아직 로딩 중이면 DOMContentLoaded에서 초기화
  // 이미 로드되었으면 즉시 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAudioStoreSync);
  } else {
    initAudioStoreSync();
  }
}
