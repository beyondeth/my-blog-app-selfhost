/**
 * useMusicPlayer - 음악 플레이어 커스텀 훅
 * AudioManager와 Zustand Store를 연결하여 음악 재생 기능 제공
 *
 * 엔터프라이즈급 설계:
 * - 이벤트 리스너 자동 정리 (메모리 누수 방지)
 * - 페이지 이동 간 재생 유지
 * - 에러 복구 메커니즘
 * - 최적화된 렌더링 (선택적 구독)
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
  useMusicStore,
  selectCurrentTrack,
  selectProgress,
  selectIsPlaying,
  selectIsLoading,
  selectHasPlaylist,
} from '@/stores/musicStore';
import { getAudioManager } from '@/lib/audio';
import type { Track, AudioError } from '@/types/music';

// ============================================
// API 상수
// ============================================

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';
const PLAYLIST_ENDPOINT = `${API_URL}/music/playlist`;
const GENRES_ENDPOINT = `${API_URL}/music/genres`;

// ============================================
// 훅 반환 타입
// ============================================

interface UseMusicPlayerReturn {
  // 상태
  playlist: readonly Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  repeatMode: 'none' | 'all' | 'one';
  isShuffled: boolean;
  error: AudioError | null;
  isDropdownOpen: boolean;

  // 장르 관련 상태
  currentGenre: string | null;
  availableGenres: readonly string[];

  // 액션
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  playTrack: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;
  setDropdownOpen: (open: boolean) => void;
  toggleDropdown: () => void;
  loadPlaylist: (genre?: string | null) => Promise<void>;
  loadAvailableGenres: () => Promise<void>;
  changeGenre: (genre: string | null) => void;
  clearError: () => void;
}

// ============================================
// 메인 훅
// ============================================

export function useMusicPlayer(): UseMusicPlayerReturn {
  // 플레이리스트 로딩 상태 추적
  const isLoadingPlaylistRef = useRef(false);

  // AudioManager 인스턴스
  const audioManager = typeof window !== 'undefined' ? getAudioManager() : null;

  // ============================================
  // Zustand Store 상태 (개별 선택자로 SSR 호환성 유지)
  // ============================================

  // 상태값 (개별 선택자)
  const playlist = useMusicStore((state) => state.playlist);
  const currentTrackIndex = useMusicStore((state) => state.currentTrackIndex);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);
  const status = useMusicStore((state) => state.status);
  const volume = useMusicStore((state) => state.volume);
  const isMuted = useMusicStore((state) => state.isMuted);
  const repeatMode = useMusicStore((state) => state.repeatMode);
  const isShuffled = useMusicStore((state) => state.isShuffled);
  const error = useMusicStore((state) => state.error);
  const isDropdownOpen = useMusicStore((state) => state.isDropdownOpen);

  // 파생 상태
  const currentTrack = useMusicStore(selectCurrentTrack);
  const progress = useMusicStore(selectProgress);
  const isPlaying = useMusicStore(selectIsPlaying);
  const isLoading = useMusicStore(selectIsLoading);

  // Store 액션 (개별 선택자)
  const setPlaylist = useMusicStore((state) => state.setPlaylist);
  const setCurrentTime = useMusicStore((state) => state.setCurrentTime);
  const setDuration = useMusicStore((state) => state.setDuration);
  const setStatus = useMusicStore((state) => state.setStatus);
  const setError = useMusicStore((state) => state.setError);
  const setVolumeAction = useMusicStore((state) => state.setVolume);
  const toggleMuteAction = useMusicStore((state) => state.toggleMute);
  const cycleRepeatModeAction = useMusicStore((state) => state.cycleRepeatMode);
  const toggleShuffleAction = useMusicStore((state) => state.toggleShuffle);
  const playTrackAction = useMusicStore((state) => state.playTrack);
  const nextTrackAction = useMusicStore((state) => state.nextTrack);
  const prevTrackAction = useMusicStore((state) => state.prevTrack);
  const togglePlayAction = useMusicStore((state) => state.togglePlay);
  const playAction = useMusicStore((state) => state.play);
  const pauseAction = useMusicStore((state) => state.pause);
  const setDropdownOpenAction = useMusicStore((state) => state.setDropdownOpen);
  const toggleDropdownAction = useMusicStore((state) => state.toggleDropdown);

  // 장르 관련 상태
  const currentGenre = useMusicStore((state) => state.currentGenre);
  const availableGenres = useMusicStore((state) => state.availableGenres);
  const setCurrentGenreAction = useMusicStore((state) => state.setCurrentGenre);
  const setAvailableGenresAction = useMusicStore((state) => state.setAvailableGenres);

  // ============================================
  // 플레이리스트 로딩
  // ============================================

  /**
   * 플레이리스트 로딩 (장르 필터 지원)
   * @param genre - 장르 필터 (null/undefined = 전체)
   * @param force - 강제 리로드 여부 (장르 변경 시 true)
   */
  const loadPlaylist = useCallback(async (genre?: string | null, force = false) => {
    // 이미 로딩 중이면 스킵
    if (isLoadingPlaylistRef.current) {
      return;
    }

    // 강제 로드가 아니고 플레이리스트가 있으면 스킵
    if (!force && playlist.length > 0) {
      return;
    }

    isLoadingPlaylistRef.current = true;

    try {
      // 장르가 있으면 쿼리 파라미터 추가
      const url = genre
        ? `${PLAYLIST_ENDPOINT}?genre=${encodeURIComponent(genre)}`
        : PLAYLIST_ENDPOINT;

      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // 백엔드는 PlaylistTrackDto[] 배열을 직접 반환 (래핑 없음)
      setPlaylist(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load playlist:', err);
      setError({
        code: 'NETWORK',
        message: '플레이리스트를 불러오는데 실패했습니다.',
      });
    } finally {
      isLoadingPlaylistRef.current = false;
    }
  }, [playlist.length, setPlaylist, setError]);

  /**
   * 사용 가능한 장르 목록 로딩
   */
  const loadAvailableGenres = useCallback(async () => {
    try {
      const response = await fetch(GENRES_ENDPOINT, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAvailableGenresAction(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load genres:', err);
      // 장르 로딩 실패는 치명적이지 않으므로 에러 상태 설정하지 않음
    }
  }, [setAvailableGenresAction]);

  /**
   * 장르 변경
   * 장르 변경 시 해당 장르의 플레이리스트를 새로 로드
   */
  const changeGenre = useCallback((genre: string | null) => {
    // 현재 장르와 같으면 스킵
    if (genre === currentGenre) {
      return;
    }

    // 장르 상태 업데이트
    setCurrentGenreAction(genre);

    // 해당 장르 플레이리스트 강제 로드
    loadPlaylist(genre, true);
  }, [currentGenre, setCurrentGenreAction, loadPlaylist]);

  // ============================================
  // AudioManager 이벤트 동기화
  // MusicProvider에서 전역으로 관리하므로 여기서는 등록하지 않음
  // 페이지 이동 간 이벤트 리스너 안정성 보장
  // ============================================

  // ============================================
  // 트랙 변경 시 오디오 소스 로드
  // 중요: currentTrack 객체 참조가 아닌 audioUrl 문자열을 의존성으로 사용
  // 페이지 이동 시 객체 참조가 변경되어도 URL이 같으면 재로드하지 않음
  // ============================================

  const currentAudioUrl = currentTrack?.audioUrl;

  useEffect(() => {
    if (!audioManager || !currentAudioUrl) return;

    // 현재 재생 중인 소스와 같으면 스킵 (페이지 이동 시 재로드 방지)
    if (audioManager.getCurrentSrc() === currentAudioUrl) {
      return;
    }

    // 새 트랙 로드
    audioManager.loadSource(currentAudioUrl);
  }, [audioManager, currentAudioUrl, currentTrackIndex]);

  // ============================================
  // 볼륨/음소거 동기화
  // ============================================

  useEffect(() => {
    if (!audioManager) return;

    audioManager.setVolume(volume);
    audioManager.setMuted(isMuted);
  }, [audioManager, volume, isMuted]);

  // ============================================
  // 재생/일시정지 동기화 - 제거됨 (v2)
  // ============================================
  // 이전 코드: useEffect로 status 감시 → audioManager.play()/pause() 호출
  // 문제점: 페이지 이동 시 리렌더링으로 인한 타이밍 이슈로 음악 끊김 발생
  // 해결: 액션 래퍼에서 AudioManager 직접 호출, audioStoreSync가 이벤트로 상태 업데이트
  // ============================================

  // ============================================
  // 액션 래퍼
  // ============================================

  const seek = useCallback(
    (time: number) => {
      if (!audioManager) return;

      audioManager.seek(time);
      setCurrentTime(time);
    },
    [audioManager, setCurrentTime]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, [setError]);

  // ============================================
  // 재생 제어 액션 (AudioManager 직접 호출)
  // audioStoreSync가 'play'/'pause' 이벤트로 Store 상태 업데이트
  // ============================================

  /**
   * 재생 시작
   * AudioManager.play()를 직접 호출하여 단방향 동기화 유지
   */
  const play = useCallback(async () => {
    if (!audioManager) return;

    // 플레이리스트가 없으면 먼저 로드
    if (playlist.length === 0) {
      await loadPlaylist();
    }

    // 트랙이 선택되지 않았으면 첫 번째 트랙 선택
    // playTrackAction이 status: 'loading' 설정 → audioStoreSync의 canplay에서 재생
    if (currentTrackIndex < 0) {
      playTrackAction(0);
    } else {
      // AudioManager 직접 재생 (audioStoreSync가 'play' 이벤트로 status 업데이트)
      audioManager.play().catch(() => {
        setStatus('paused');
      });
    }
  }, [audioManager, playlist.length, currentTrackIndex, loadPlaylist, playTrackAction, setStatus]);

  /**
   * 일시정지
   * AudioManager.pause()를 직접 호출하여 단방향 동기화 유지
   */
  const pause = useCallback(() => {
    if (!audioManager) return;
    // AudioManager 직접 일시정지 (audioStoreSync가 'pause' 이벤트로 status 업데이트)
    audioManager.pause();
  }, [audioManager]);

  /**
   * 재생/일시정지 토글
   * AudioManager를 직접 호출하여 단방향 동기화 유지
   */
  const togglePlay = useCallback(async () => {
    if (!audioManager) return;

    // 플레이리스트가 없으면 먼저 로드
    if (playlist.length === 0) {
      await loadPlaylist();
    }

    if (status === 'playing') {
      // 재생 중이면 일시정지
      audioManager.pause();
    } else if (status === 'paused' || status === 'idle') {
      // 일시정지/대기 중이면 재생
      if (currentTrackIndex < 0) {
        // 트랙 미선택 시 첫 트랙 선택 (status: 'loading' → canplay에서 재생)
        playTrackAction(0);
      } else {
        // AudioManager 직접 재생
        audioManager.play().catch(() => {
          setStatus('paused');
        });
      }
    }
  }, [audioManager, playlist.length, status, currentTrackIndex, loadPlaylist, playTrackAction, setStatus]);

  // ============================================
  // 반환값
  // ============================================

  return {
    // 상태
    playlist,
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    currentTime,
    duration,
    volume,
    isMuted,
    repeatMode,
    isShuffled,
    error,
    isDropdownOpen,

    // 장르 관련 상태
    currentGenre,
    availableGenres,

    // 액션
    play,
    pause,
    togglePlay,
    playTrack: playTrackAction,
    nextTrack: nextTrackAction,
    prevTrack: prevTrackAction,
    seek,
    setVolume: setVolumeAction,
    toggleMute: toggleMuteAction,
    cycleRepeatMode: cycleRepeatModeAction,
    toggleShuffle: toggleShuffleAction,
    setDropdownOpen: setDropdownOpenAction,
    toggleDropdown: toggleDropdownAction,
    loadPlaylist,
    loadAvailableGenres,
    changeGenre,
    clearError,
  };
}

// ============================================
// 경량 훅 (UI 컴포넌트용)
// ============================================

/**
 * 재생 상태만 필요한 경우 (헤더 아이콘 등)
 */
export function useMusicPlayerStatus() {
  const isPlaying = useMusicStore(selectIsPlaying);
  const isLoading = useMusicStore(selectIsLoading);
  // selectHasPlaylist 사용 - 인라인 선택자는 매 렌더링마다 새 참조 생성하여 메모이제이션 실패
  const hasPlaylist = useMusicStore(selectHasPlaylist);
  const currentTrack = useMusicStore(selectCurrentTrack);

  return { isPlaying, isLoading, hasPlaylist, currentTrack };
}

/**
 * 볼륨 제어만 필요한 경우
 */
export function useMusicVolume() {
  const volume = useMusicStore((state) => state.volume);
  const isMuted = useMusicStore((state) => state.isMuted);
  const setVolume = useMusicStore((state) => state.setVolume);
  const toggleMute = useMusicStore((state) => state.toggleMute);

  return { volume, isMuted, setVolume, toggleMute };
}

/**
 * 진행률 바만 필요한 경우
 */
export function useMusicProgress() {
  const progress = useMusicStore(selectProgress);
  const currentTime = useMusicStore((state) => state.currentTime);
  const duration = useMusicStore((state) => state.duration);

  const audioManager = typeof window !== 'undefined' ? getAudioManager() : null;

  const seek = useCallback(
    (time: number) => {
      if (!audioManager) return;
      audioManager.seek(time);
      useMusicStore.getState().setCurrentTime(time);
    },
    [audioManager]
  );

  return { progress, currentTime, duration, seek };
}

// 기본 내보내기
export default useMusicPlayer;
