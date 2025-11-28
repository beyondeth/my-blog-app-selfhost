'use client';

/**
 * MusicProvider - 음악 플레이어 전역 Provider (간소화 버전)
 *
 * 핵심 변경 (v3):
 * - 이벤트 리스너는 모듈 레벨(audioStoreSync.ts)에서 관리
 * - 이 Provider는 Context 제공 역할만 수행
 * - React 컴포넌트 리마운트에 영향받지 않음
 *
 * 이전 문제점:
 * - useEffect cleanup에서 isInitializedRef.current = false 설정
 * - Suspense 경계 영향으로 Provider 재마운트 시 이벤트 리스너 재등록
 * - 일시적 상태 불일치로 음악 끊김 발생
 *
 * 해결:
 * - audioStoreSync.ts에서 모듈 로드 시 이벤트 리스너 등록 (cleanup 없음)
 * - 앱 생명주기와 동일하게 유지
 */

import { useEffect, createContext, useContext } from 'react';
import { initAudioStoreSync, isAudioStoreSyncInitialized } from '@/lib/audio';

// Context: Provider 초기화 여부 확인용
const MusicContext = createContext<boolean>(false);

/**
 * MusicProvider 초기화 여부 확인 훅
 */
export function useMusicProviderInitialized(): boolean {
  return useContext(MusicContext);
}

interface MusicProviderProps {
  children: React.ReactNode;
}

/**
 * MusicProvider
 * Context만 제공, 이벤트 리스너는 모듈 레벨에서 관리
 */
export function MusicProvider({ children }: MusicProviderProps) {
  // 안전장치: CSR 전환 등으로 모듈 레벨 초기화가 누락된 경우 대비
  useEffect(() => {
    if (!isAudioStoreSyncInitialized()) {
      initAudioStoreSync();
    }
  }, []);

  return (
    <MusicContext.Provider value={true}>
      {children}
    </MusicContext.Provider>
  );
}

export default MusicProvider;
