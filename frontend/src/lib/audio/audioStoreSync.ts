/**
 * audioStoreSync.ts - 모듈 레벨 AudioManager-Store 동기화
 *
 * 핵심 설계:
 * - React 컴포넌트 생명주기와 완전히 독립
 * - 모듈 로드 시 한 번만 실행
 * - 어떤 컴포넌트가 리마운트되어도 오디오 상태 유지
 *
 * 이전 문제점:
 * - MusicProvider에서 useEffect로 이벤트 리스너 등록
 * - Suspense 경계 영향으로 Provider 재마운트 시 리스너 재등록
 * - 이로 인한 일시적 상태 불일치로 음악 끊김 발생
 *
 * 해결:
 * - 모듈 레벨에서 이벤트 리스너 등록 (cleanup 없음)
 * - 앱 생명주기와 동일하게 유지
 */

import { getAudioManager } from './AudioManager';
import { useMusicStore } from '@/stores/musicStore';

// 초기화 플래그 (모듈 레벨 - React 외부)
let isInitialized = false;

/**
 * AudioManager와 Zustand Store 동기화 초기화
 * 모듈 레벨에서 한 번만 실행됨
 */
export function initAudioStoreSync(): void {
  // 서버 사이드에서는 실행 안 함
  if (typeof window === 'undefined') return;

  // 이미 초기화되었으면 스킵
  if (isInitialized) return;

  const audioManager = getAudioManager();

  // ============================================
  // 이벤트 핸들러 정의
  // Store의 getState()를 직접 호출하여 React 의존성 제거
  // ============================================

  const handleTimeUpdate = () => {
    useMusicStore.getState().setCurrentTime(audioManager.getCurrentTime());
  };

  const handleLoadedMetadata = () => {
    useMusicStore.getState().setDuration(audioManager.getDuration());
  };

  const handleCanPlay = () => {
    // canplay 이벤트: 오디오가 재생 가능한 상태
    const currentStatus = useMusicStore.getState().status;

    // 'loading' 상태: 사용자가 명시적으로 재생 요청 (playTrack, togglePlay 등)
    // → 재생 시작
    if (currentStatus === 'loading') {
      audioManager.play().catch(() => {
        // 자동재생 차단된 경우 paused 상태로
        useMusicStore.getState().setStatus('paused');
      });
    }
    // 그 외 (idle, paused 등): 자동 재생하지 않음
    // 첫 트랙 자동 선택 시 status가 idle이므로 재생 안 됨
  };

  const handlePlay = () => {
    useMusicStore.getState().setStatus('playing');
  };

  const handlePause = () => {
    // 상태가 loading이면 무시 (트랙 전환 중)
    const currentStatus = useMusicStore.getState().status;
    if (currentStatus !== 'loading') {
      useMusicStore.getState().setStatus('paused');
    }
  };

  const handleEnded = () => {
    const { repeatMode } = useMusicStore.getState();

    // 한 곡 반복 모드: 처음으로 되돌리고 재생
    if (repeatMode === 'one') {
      audioManager.seek(0);
      audioManager.play().catch(() => {
        useMusicStore.getState().setStatus('paused');
      });
      return;
    }

    // 그 외: 다음 트랙으로 이동
    useMusicStore.getState().nextTrack();
  };

  const handleError = () => {
    const audioError = audioManager.getCurrentSrc()
      ? {
          code: 'UNKNOWN' as const,
          message: '오디오 재생 중 오류가 발생했습니다.',
        }
      : null;
    if (audioError) {
      useMusicStore.getState().setError(audioError);
    }
  };

  const handleWaiting = () => {
    useMusicStore.getState().setStatus('loading');
  };

  // ============================================
  // 이벤트 리스너 등록 (cleanup 없음 - 앱 생명주기와 동일)
  // ============================================

  audioManager.addEventListener('timeupdate', handleTimeUpdate);
  audioManager.addEventListener('loadedmetadata', handleLoadedMetadata);
  audioManager.addEventListener('canplay', handleCanPlay);
  audioManager.addEventListener('play', handlePlay);
  audioManager.addEventListener('pause', handlePause);
  audioManager.addEventListener('ended', handleEnded);
  audioManager.addEventListener('error', handleError);
  audioManager.addEventListener('waiting', handleWaiting);

  isInitialized = true;
}

/**
 * 초기화 상태 확인
 */
export function isAudioStoreSyncInitialized(): boolean {
  return isInitialized;
}
