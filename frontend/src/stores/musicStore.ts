/**
 * 음악 플레이어 Zustand Store
 * 엔터프라이즈급 설계 - 메모리 누수 방지, 최적화된 상태 관리
 */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import type {
  Track,
  RepeatMode,
  PlayerStatus,
  AudioError,
  MusicPlayerState,
  MusicPlayerActions,
} from '@/types/music';

// ============================================
// 상수 정의
// ============================================

const STORE_NAME = 'music-player-store';
const DEVTOOLS_NAME = 'MusicStore';

// 기본 상태값
const DEFAULT_STATE: MusicPlayerState = {
  // 플레이리스트
  playlist: [],
  currentTrackIndex: -1,

  // 표시용 트랙 (장르 변경 시 플레이어 UI 유지용)
  displayedTrack: null,

  // 장르 관련
  currentGenre: null, // null = 전체
  availableGenres: [],

  // 재생 상태
  status: 'idle',
  currentTime: 0,
  duration: 0,

  // 설정
  volume: 0.7,
  isMuted: false,
  repeatMode: 'none',
  isShuffled: false,
  shuffledIndices: [],

  // UI 상태
  isDropdownOpen: false,

  // 에러 상태
  error: null,
};

// ============================================
// 유틸리티 함수
// ============================================

/**
 * Fisher-Yates 셔플 알고리즘
 * 배열을 무작위로 섞는 가장 효율적인 방법 O(n)
 */
function fisherYatesShuffle(length: number, currentIndex: number): number[] {
  // 0부터 length-1까지의 인덱스 배열 생성
  const indices = Array.from({ length }, (_, i) => i);

  // Fisher-Yates 알고리즘으로 셔플
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  // 현재 재생 중인 트랙이 있으면 맨 앞으로 이동
  if (currentIndex >= 0 && currentIndex < length) {
    const currentPos = indices.indexOf(currentIndex);
    if (currentPos > 0) {
      [indices[0], indices[currentPos]] = [indices[currentPos], indices[0]];
    }
  }

  return indices;
}

/**
 * 다음 트랙 인덱스 계산
 */
function getNextTrackIndex(
  currentIndex: number,
  playlistLength: number,
  repeatMode: RepeatMode,
  isShuffled: boolean,
  shuffledIndices: readonly number[]
): number {
  if (playlistLength === 0) return -1;

  // 한 곡 반복
  if (repeatMode === 'one') {
    return currentIndex;
  }

  // 셔플 모드
  if (isShuffled && shuffledIndices.length > 0) {
    const currentShufflePos = shuffledIndices.indexOf(currentIndex);
    const nextShufflePos = currentShufflePos + 1;

    if (nextShufflePos >= shuffledIndices.length) {
      // 전체 반복이면 처음으로, 아니면 정지
      return repeatMode === 'all' ? shuffledIndices[0] : -1;
    }
    return shuffledIndices[nextShufflePos];
  }

  // 일반 모드
  const nextIndex = currentIndex + 1;
  if (nextIndex >= playlistLength) {
    return repeatMode === 'all' ? 0 : -1;
  }
  return nextIndex;
}

/**
 * 이전 트랙 인덱스 계산
 */
function getPrevTrackIndex(
  currentIndex: number,
  playlistLength: number,
  isShuffled: boolean,
  shuffledIndices: readonly number[]
): number {
  if (playlistLength === 0) return -1;

  // 셔플 모드
  if (isShuffled && shuffledIndices.length > 0) {
    const currentShufflePos = shuffledIndices.indexOf(currentIndex);
    const prevShufflePos = currentShufflePos - 1;

    if (prevShufflePos < 0) {
      return shuffledIndices[shuffledIndices.length - 1];
    }
    return shuffledIndices[prevShufflePos];
  }

  // 일반 모드
  const prevIndex = currentIndex - 1;
  if (prevIndex < 0) {
    return playlistLength - 1;
  }
  return prevIndex;
}

// ============================================
// Store 타입 정의
// ============================================

type MusicStore = MusicPlayerState & MusicPlayerActions;

// ============================================
// Store 생성
// ============================================

export const useMusicStore = create<MusicStore>()(
  subscribeWithSelector(
    devtools(
      persist(
        (set, get) => ({
          // ============================================
          // 초기 상태
          // ============================================
          ...DEFAULT_STATE,

          // ============================================
          // 재생 제어 액션
          // ============================================

          /**
           * 재생 시작
           */
          play: () => {
            const { playlist, currentTrackIndex } = get();
            if (playlist.length === 0) return;

            // 트랙이 선택되지 않았으면 첫 번째 트랙 선택
            if (currentTrackIndex < 0) {
              set({ currentTrackIndex: 0, status: 'loading' });
            } else {
              set({ status: 'playing' });
            }
          },

          /**
           * 일시정지
           */
          pause: () => {
            set({ status: 'paused' });
          },

          /**
           * 재생/일시정지 토글
           */
          togglePlay: () => {
            const { status, playlist, currentTrackIndex } = get();

            if (playlist.length === 0) return;

            if (status === 'playing') {
              set({ status: 'paused' });
            } else if (status === 'paused' || status === 'idle') {
              if (currentTrackIndex < 0) {
                set({ currentTrackIndex: 0, status: 'loading' });
              } else {
                set({ status: 'playing' });
              }
            }
          },

          /**
           * 정지 (처음으로 되돌림)
           */
          stop: () => {
            set({
              status: 'idle',
              currentTime: 0,
            });
          },

          // ============================================
          // 트랙 제어 액션
          // ============================================

          /**
           * 특정 트랙 재생
           */
          playTrack: (index: number) => {
            const { playlist } = get();
            if (index < 0 || index >= playlist.length) return;

            set({
              currentTrackIndex: index,
              displayedTrack: playlist[index], // 현재 트랙을 displayedTrack에도 저장
              status: 'loading',
              currentTime: 0,
              duration: 0,
              error: null,
            });
          },

          /**
           * 다음 트랙
           */
          nextTrack: () => {
            const { currentTrackIndex, playlist, repeatMode, isShuffled, shuffledIndices } = get();

            const nextIndex = getNextTrackIndex(
              currentTrackIndex,
              playlist.length,
              repeatMode,
              isShuffled,
              shuffledIndices
            );

            if (nextIndex >= 0) {
              set({
                currentTrackIndex: nextIndex,
                displayedTrack: playlist[nextIndex], // displayedTrack 업데이트
                status: 'loading',
                currentTime: 0,
                duration: 0,
                error: null,
              });
            } else {
              // 재생 목록 끝
              set({
                status: 'idle',
                currentTime: 0,
              });
            }
          },

          /**
           * 이전 트랙
           */
          prevTrack: () => {
            const { currentTrackIndex, playlist, isShuffled, shuffledIndices, currentTime } = get();

            // 3초 이상 재생했으면 처음으로
            if (currentTime > 3) {
              set({ currentTime: 0 });
              return;
            }

            const prevIndex = getPrevTrackIndex(
              currentTrackIndex,
              playlist.length,
              isShuffled,
              shuffledIndices
            );

            if (prevIndex >= 0) {
              set({
                currentTrackIndex: prevIndex,
                displayedTrack: playlist[prevIndex], // displayedTrack 업데이트
                status: 'loading',
                currentTime: 0,
                duration: 0,
                error: null,
              });
            }
          },

          // ============================================
          // 시간 제어 액션
          // ============================================

          /**
           * 현재 재생 시간 설정
           */
          setCurrentTime: (time: number) => {
            set({ currentTime: time });
          },

          /**
           * 총 재생 시간 설정
           */
          setDuration: (duration: number) => {
            set({ duration });
          },

          // ============================================
          // 볼륨 제어 액션
          // ============================================

          /**
           * 볼륨 설정 (0-1)
           */
          setVolume: (volume: number) => {
            const clampedVolume = Math.max(0, Math.min(1, volume));
            set({
              volume: clampedVolume,
              isMuted: clampedVolume === 0,
            });
          },

          /**
           * 음소거 토글
           */
          toggleMute: () => {
            set((state) => ({ isMuted: !state.isMuted }));
          },

          // ============================================
          // 재생 모드 액션
          // ============================================

          /**
           * 반복 모드 설정
           */
          setRepeatMode: (mode: RepeatMode) => {
            set({ repeatMode: mode });
          },

          /**
           * 반복 모드 순환 (none -> all -> one -> none)
           */
          cycleRepeatMode: () => {
            set((state) => {
              const modes: RepeatMode[] = ['none', 'all', 'one'];
              const currentIdx = modes.indexOf(state.repeatMode);
              const nextIdx = (currentIdx + 1) % modes.length;
              return { repeatMode: modes[nextIdx] };
            });
          },

          /**
           * 셔플 토글
           */
          toggleShuffle: () => {
            set((state) => {
              const newIsShuffled = !state.isShuffled;

              if (newIsShuffled) {
                // 셔플 활성화: 새로운 셔플 순서 생성
                const shuffledIndices = fisherYatesShuffle(
                  state.playlist.length,
                  state.currentTrackIndex
                );
                return { isShuffled: true, shuffledIndices };
              } else {
                // 셔플 비활성화
                return { isShuffled: false, shuffledIndices: [] };
              }
            });
          },

          // ============================================
          // 플레이리스트 관리 액션
          // ============================================

          /**
           * 플레이리스트 설정
           * 장르 변경 시에도 플레이어 UI가 축소되지 않도록 displayedTrack 유지
           */
          setPlaylist: (tracks: Track[]) => {
            const { isShuffled, currentTrackIndex, displayedTrack } = get();

            // 셔플 모드면 새로운 셔플 순서 생성
            const shuffledIndices = isShuffled
              ? fisherYatesShuffle(tracks.length, currentTrackIndex)
              : [];

            // 새 currentTrackIndex 결정:
            // 1. 트랙 있고 선택된 트랙 없으면 첫 트랙 자동 선택 (0)
            // 2. 빈 플레이리스트: currentTrackIndex 유지
            // 3. 그 외에는 기존 인덱스 유지
            let newTrackIndex = currentTrackIndex;
            if (tracks.length > 0 && currentTrackIndex === -1) {
              // 트랙 있는데 선택 안됨 → 첫 트랙 자동 선택 (재생 X)
              newTrackIndex = 0;
            }

            // displayedTrack 결정:
            // 트랙이 있으면 현재 또는 첫 트랙으로 업데이트
            // 트랙이 없으면 기존 displayedTrack 유지 (플레이어 UI 축소 방지)
            let newDisplayedTrack = displayedTrack;
            if (tracks.length > 0) {
              const targetIndex = newTrackIndex >= 0 && newTrackIndex < tracks.length
                ? newTrackIndex
                : 0;
              newDisplayedTrack = tracks[targetIndex];
            }
            // Note: 빈 플레이리스트일 때는 displayedTrack 유지

            set({
              playlist: tracks,
              shuffledIndices,
              currentTrackIndex: newTrackIndex,
              displayedTrack: newDisplayedTrack,
            });
          },

          /**
           * 플레이리스트 초기화
           */
          clearPlaylist: () => {
            set({
              playlist: [],
              currentTrackIndex: -1,
              displayedTrack: null, // 명시적 초기화 시에만 displayedTrack 리셋
              shuffledIndices: [],
              status: 'idle',
              currentTime: 0,
              duration: 0,
            });
          },

          // ============================================
          // 장르 관리 액션
          // ============================================

          /**
           * 현재 장르 설정
           * @param genre - 장르 (null = 전체)
           */
          setCurrentGenre: (genre: string | null) => {
            set({ currentGenre: genre });
          },

          /**
           * 사용 가능한 장르 목록 설정
           */
          setAvailableGenres: (genres: string[]) => {
            set({ availableGenres: genres });
          },

          // ============================================
          // UI 제어 액션
          // ============================================

          /**
           * 드롭다운 열기/닫기 설정
           */
          setDropdownOpen: (open: boolean) => {
            set({ isDropdownOpen: open });
          },

          /**
           * 드롭다운 토글
           */
          toggleDropdown: () => {
            set((state) => ({ isDropdownOpen: !state.isDropdownOpen }));
          },

          // ============================================
          // 상태 관리 액션
          // ============================================

          /**
           * 플레이어 상태 설정
           */
          setStatus: (status: PlayerStatus) => {
            set({ status });
          },

          /**
           * 에러 설정
           */
          setError: (error: AudioError | null) => {
            set({
              error,
              status: error ? 'error' : get().status,
            });
          },

          /**
           * 전체 상태 초기화
           */
          reset: () => {
            set(DEFAULT_STATE);
          },
        }),
        {
          name: STORE_NAME,
          // 영구 저장할 상태만 선택 (플레이리스트, 재생 상태는 제외)
          partialize: (state) => ({
            volume: state.volume,
            isMuted: state.isMuted,
            repeatMode: state.repeatMode,
            isShuffled: state.isShuffled,
          }),
        }
      ),
      { name: DEVTOOLS_NAME }
    )
  )
);

// ============================================
// 셀렉터 (메모이제이션 최적화)
// ============================================

/**
 * 현재 재생 중인 트랙
 * 플레이리스트가 비어있어도 displayedTrack을 반환하여 플레이어 UI 유지
 */
export const selectCurrentTrack = (state: MusicStore): Track | null => {
  const { playlist, currentTrackIndex, displayedTrack } = state;

  // 현재 플레이리스트에서 유효한 트랙이 있으면 반환
  if (currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
    return playlist[currentTrackIndex];
  }

  // 없으면 displayedTrack 반환 (플레이어 UI 축소 방지)
  return displayedTrack;
};

/**
 * 재생 진행률 (0-100)
 */
export const selectProgress = (state: MusicStore): number => {
  const { currentTime, duration } = state;
  if (duration <= 0) return 0;
  return (currentTime / duration) * 100;
};

/**
 * 재생 가능 여부
 */
export const selectCanPlay = (state: MusicStore): boolean => {
  return state.playlist.length > 0;
};

/**
 * 다음 트랙 존재 여부
 */
export const selectHasNext = (state: MusicStore): boolean => {
  const { currentTrackIndex, playlist, repeatMode, isShuffled, shuffledIndices } = state;
  return (
    getNextTrackIndex(currentTrackIndex, playlist.length, repeatMode, isShuffled, shuffledIndices) >=
    0
  );
};

/**
 * 이전 트랙 존재 여부
 */
export const selectHasPrev = (state: MusicStore): boolean => {
  return state.playlist.length > 0;
};

/**
 * 재생 중 여부
 */
export const selectIsPlaying = (state: MusicStore): boolean => {
  return state.status === 'playing';
};

/**
 * 로딩 중 여부
 */
export const selectIsLoading = (state: MusicStore): boolean => {
  return state.status === 'loading';
};

/**
 * 플레이리스트 존재 여부
 * 인라인 선택자 대체용 - Zustand 메모이제이션 최적화
 */
export const selectHasPlaylist = (state: MusicStore): boolean => {
  return state.playlist.length > 0;
};

/**
 * 현재 선택된 장르
 */
export const selectCurrentGenre = (state: MusicStore): string | null => {
  return state.currentGenre;
};

/**
 * 사용 가능한 장르 목록
 */
export const selectAvailableGenres = (state: MusicStore): readonly string[] => {
  return state.availableGenres;
};

// ============================================
// 타입 내보내기
// ============================================

export type { MusicStore };
