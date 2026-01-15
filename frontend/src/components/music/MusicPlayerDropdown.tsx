'use client';

/**
 * MusicPlayerDropdown - 음악 플레이어 드롭다운
 * 미니 플레이어 UI - 재생 컨트롤, 플레이리스트, 볼륨 조절
 *
 * 엔터프라이즈급 설계:
 * - React Portal을 사용하여 body에 직접 렌더링 (페이지 이동 영향 없음)
 * - 외부 클릭 감지로 드롭다운 닫기
 * - 키보드 접근성 지원
 * - 반응형 디자인
 */

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useMusicPlayer } from '@/hooks/useMusicPlayer';
import { useMusicStore } from '@/stores/musicStore';
import { formatTime } from '@/types/music';
import type { Track, SyncedLyricLine } from '@/types/music';
import { GenreTabs } from './GenreTab';

// ============================================
// 아이콘 컴포넌트들
// ============================================

function PlayIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8 5.14v14l11-7-11-7z" />
    </svg>
  );
}

function PauseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
    </svg>
  );
}

function PrevIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z" />
    </svg>
  );
}

function NextIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M16 18h2V6h-2v12zM6 18l8.5-6L6 6v12z" />
    </svg>
  );
}

function ShuffleIcon({ className = 'w-4 h-4', active = false }: { className?: string; active?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} ${active ? 'text-green-500' : ''}`}
    >
      <path d="M16 3h5v5" />
      <path d="M4 20 21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

function RepeatIcon({
  className = 'w-4 h-4',
  mode = 'none',
}: {
  className?: string;
  mode?: 'none' | 'all' | 'one';
}) {
  const isActive = mode !== 'none';

  return (
    <div className="relative">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`${className} ${isActive ? 'text-green-500' : ''}`}
      >
        <path d="m17 2 4 4-4 4" />
        <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
        <path d="m7 22-4-4 4-4" />
        <path d="M21 13v1a4 4 0 0 1-4 4H3" />
      </svg>
      {mode === 'one' && (
        <span className="absolute -top-1 -right-1 text-[8px] font-bold text-green-500">1</span>
      )}
    </div>
  );
}

function LyricsIcon({ className = 'w-4 h-4', active = false }: { className?: string; active?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} ${active ? 'text-green-500' : ''}`}
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

function VolumeIcon({
  className = 'w-4 h-4',
  muted = false,
  volume = 1,
}: {
  className?: string;
  muted?: boolean;
  volume?: number;
}) {
  if (muted || volume === 0) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line x1="23" y1="9" x2="17" y2="15" />
        <line x1="17" y1="9" x2="23" y2="15" />
      </svg>
    );
  }

  if (volume < 0.5) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

// ============================================
// 프로그레스 바 컴포넌트
// ============================================

interface ProgressBarProps {
  progress: number;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

function ProgressBar({ progress, currentTime, duration, onSeek }: ProgressBarProps) {
  const progressRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleSeek = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || duration <= 0) return;

      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(percent * duration);
    },
    [duration, onSeek]
  );

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();
      setIsDragging(true);
      handleSeek(e);
    },
    [handleSeek]
  );

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current || duration <= 0) return;

      const rect = progressRef.current.getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      onSeek(percent * duration);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, duration, onSeek]);

  return (
    <div className="w-full space-y-1">
      {/* 프로그레스 바 */}
      <div
        ref={progressRef}
        className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full cursor-pointer group"
        onMouseDown={handleMouseDown}
      >
        <div
          className="h-full bg-green-500 rounded-full relative transition-all pointer-events-none"
          style={{ width: `${progress}%` }}
        >
          {/* 드래그 핸들 */}
          <div
            className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md border border-gray-200
                        opacity-0 group-hover:opacity-100 ${isDragging ? 'opacity-100' : ''} transition-opacity pointer-events-none`}
          />
        </div>
      </div>

      {/* 시간 표시 */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}

// ============================================
// 볼륨 슬라이더 컴포넌트
// ============================================

interface VolumeSliderProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

function VolumeSlider({ volume, isMuted, onVolumeChange, onToggleMute }: VolumeSliderProps) {
  const [showSlider, setShowSlider] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onVolumeChange(parseFloat(e.target.value));
  };

  React.useEffect(() => {
    if (!isDragging) return;
    const handleMouseUp = () => setIsDragging(false);
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  const isSliderVisible = showSlider || isDragging;

  return (
    <div
      className="flex items-center"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => { if (!isDragging) setShowSlider(false); }}
    >
      {/* 가로 슬라이더 (왼쪽으로 펼쳐짐 - 버튼과 연결) */}
      <div
        className={`flex items-center overflow-hidden transition-all duration-200 ${
          isSliderVisible ? 'w-28 opacity-100' : 'w-0 opacity-0'
        }`}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
      >
        <div className="flex items-center gap-2 pr-1">
          <span className="text-[10px] text-muted-foreground w-6 text-right">
            {Math.round((isMuted ? 0 : volume) * 100)}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setIsDragging(true);
            }}
            className="w-16 h-1 accent-green-500 cursor-pointer"
          />
        </div>
      </div>

      {/* 볼륨 버튼 */}
      <button
        onMouseDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          onToggleMute();
        }}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0"
        aria-label={isMuted ? '음소거 해제' : '음소거'}
      >
        <VolumeIcon className="w-4 h-4" muted={isMuted} volume={volume} />
      </button>
    </div>
  );
}

// ============================================
// 트랙 아이템 컴포넌트
// ============================================

interface TrackItemProps {
  track: Track;
  index: number;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: (index: number) => void;
}

function TrackItem({ track, index, isActive, isPlaying, onPlay }: TrackItemProps) {
  const handleMouseDown = (e: React.MouseEvent) => {
    // mousedown에서 직접 처리 + 네이티브 이벤트 전파 차단 (드롭다운 닫힘 방지)
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    onPlay(index);
  };

  return (
    <button
      onMouseDown={handleMouseDown}
      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left
                 ${isActive ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}
    >
      {/* 커버 이미지 + 트랙 번호/재생 애니메이션 */}
      <div className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-gray-100 dark:bg-gray-800">
        {track.coverUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={track.coverUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-gray-400"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        )}
        {/* 재생 중 오버레이 */}
        {isActive && isPlaying && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="flex items-end gap-0.5 h-4">
              <span className="w-0.5 bg-green-400 animate-[musicBar1_0.5s_ease-in-out_infinite]" style={{ height: '60%' }} />
              <span className="w-0.5 bg-green-400 animate-[musicBar2_0.5s_ease-in-out_infinite_0.1s]" style={{ height: '100%' }} />
              <span className="w-0.5 bg-green-400 animate-[musicBar3_0.5s_ease-in-out_infinite_0.2s]" style={{ height: '40%' }} />
            </div>
          </div>
        )}
      </div>

      {/* 트랙 정보 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isActive ? 'text-green-600 dark:text-green-400 font-medium' : 'text-foreground'}`}>
          {track.title}
        </p>
        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
      </div>

      {/* 재생 시간 */}
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {track.duration ? formatTime(track.duration) : '--:--'}
      </span>
    </button>
  );
}

// ============================================
// 가사 표시 컴포넌트
// ============================================

interface LyricsDisplayProps {
  lyrics?: string;
  syncedLyrics?: SyncedLyricLine[];
  currentTime: number; // 밀리초 단위
}

/**
 * 가사 표시 컴포넌트
 * - 동기화된 가사가 있으면 현재 재생 시간에 맞춰 하이라이트
 * - 일반 가사만 있으면 전체 가사 표시
 * - 자동 스크롤로 현재 가사 라인을 중앙에 유지
 */
function LyricsDisplay({ lyrics, syncedLyrics, currentTime }: LyricsDisplayProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const activeLineRef = React.useRef<HTMLDivElement>(null);

  // 현재 시간(초)을 밀리초로 변환
  const currentTimeMs = currentTime * 1000;

  // 현재 재생 중인 가사 라인 인덱스 찾기
  const currentLineIndex = React.useMemo(() => {
    if (!syncedLyrics || syncedLyrics.length === 0) return -1;

    // 현재 시간보다 작거나 같은 가장 마지막 타임스탬프 찾기
    let foundIndex = -1;
    for (let i = 0; i < syncedLyrics.length; i++) {
      if (syncedLyrics[i].time <= currentTimeMs) {
        foundIndex = i;
      } else {
        break;
      }
    }
    return foundIndex;
  }, [syncedLyrics, currentTimeMs]);

  // 현재 가사 라인으로 자동 스크롤
  React.useEffect(() => {
    if (activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const activeLine = activeLineRef.current;

      // 컨테이너 중앙에 현재 라인이 오도록 스크롤
      const containerHeight = container.clientHeight;
      const lineTop = activeLine.offsetTop;
      const lineHeight = activeLine.clientHeight;
      const scrollTarget = lineTop - containerHeight / 2 + lineHeight / 2;

      container.scrollTo({
        top: Math.max(0, scrollTarget),
        behavior: 'smooth',
      });
    }
  }, [currentLineIndex]);

  // 가사 없음
  if (!lyrics && (!syncedLyrics || syncedLyrics.length === 0)) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <p>가사가 없습니다</p>
      </div>
    );
  }

  // 동기화된 가사 표시
  if (syncedLyrics && syncedLyrics.length > 0) {
    return (
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-4 py-2 scroll-smooth"
      >
        <div className="space-y-2 py-8">
          {syncedLyrics.map((line, index) => {
            const isActive = index === currentLineIndex;
            const isPast = index < currentLineIndex;

            return (
              <div
                key={`${line.time}-${index}`}
                ref={isActive ? activeLineRef : null}
                className={`text-center transition-all duration-300 ${
                  isActive
                    ? 'text-green-500 dark:text-green-400 font-semibold text-base scale-105'
                    : isPast
                      ? 'text-muted-foreground/50 text-sm'
                      : 'text-muted-foreground text-sm'
                }`}
              >
                {line.text || '♪'}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 일반 텍스트 가사 표시
  return (
    <div className="h-full overflow-y-auto px-4 py-2">
      <div className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
        {lyrics}
      </div>
    </div>
  );
}

// ============================================
// 메인 드롭다운 컴포넌트
// ============================================

/**
 * MusicPlayerDropdown
 *
 * 최적화 (v2):
 * - Header 리렌더링과 완전 분리
 * - useMusicStore에서 직접 상태 접근 (props 의존성 제거)
 * - React.memo로 불필요한 리렌더링 방지
 */
function MusicPlayerDropdownInner() {
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  // 탭 상태: 'playlist' | 'lyrics'
  const [activeTab, setActiveTab] = React.useState<'playlist' | 'lyrics'>('playlist');

  // Store에서 직접 상태 접근 (Header 리렌더링 영향 없음)
  const isOpen = useMusicStore((state) => state.isDropdownOpen);
  const onClose = useMusicStore((state) => state.setDropdownOpen);
  const handleClose = React.useCallback(() => onClose(false), [onClose]);

  const {
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
    currentGenre,
    availableGenres,
    togglePlay,
    playTrack,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    cycleRepeatMode,
    toggleShuffle,
    loadPlaylist,
    loadAvailableGenres,
    changeGenre,
    clearError,
  } = useMusicPlayer();

  // 현재 트랙에 가사가 있는지 확인
  const hasLyrics = Boolean(currentTrack?.lyrics || (currentTrack?.syncedLyrics && currentTrack.syncedLyrics.length > 0));

  // 드롭다운 열릴 때 플레이리스트 및 장르 목록 로드
  React.useEffect(() => {
    if (isOpen) {
      // 장르 목록 로드 (항상 로드하여 최신 상태 유지)
      if (availableGenres.length === 0) {
        loadAvailableGenres();
      }

      // 플레이리스트 로드 (없을 때만)
      if (playlist.length === 0) {
        loadPlaylist(currentGenre);
      }
    }
  }, [isOpen, playlist.length, availableGenres.length, currentGenre, loadPlaylist, loadAvailableGenres]);

  // 외부 클릭 감지
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleClose();
      }
    };

    // 약간의 지연을 두어 버튼 클릭과 충돌 방지
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, handleClose]);

  // ESC 키로 닫기
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleClose]);

  // SSR에서는 렌더링하지 않음
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const currentIndex = currentTrack
    ? playlist.findIndex((t) => t.id === currentTrack.id)
    : -1;

  // Portal로 body에 직접 렌더링 (Header 리렌더링과 완전 분리)
  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="fixed top-16 right-4 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-border overflow-hidden"
      style={{ zIndex: 9999 }}
      role="dialog"
      aria-label="음악 플레이어"
      onMouseDown={(e) => {
        // 드롭다운 내부 클릭 시 이벤트 전파 차단 (빈 공간 클릭해도 닫히지 않도록)
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
      }}
    >
      {/* 에러 메시지 */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
            <button
              onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); clearError(); }}
              className="text-red-500 hover:text-red-600 text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 현재 트랙 정보 */}
      <div className="p-4 border-b border-border">
        {currentTrack ? (
          <div className="space-y-3">
            {/* 커버 이미지 + 트랙 정보 */}
            <div className="flex items-center gap-3">
              {/* 앨범 커버 */}
              <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                {currentTrack.coverUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentTrack.coverUrl}
                      alt={`${currentTrack.title} 앨범 커버`}
                      className="w-full h-full object-cover"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="w-8 h-8 text-gray-400"
                    >
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                    </svg>
                  </div>
                )}
              </div>

              {/* 트랙 정보 */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-foreground truncate">{currentTrack.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{currentTrack.artist}</p>
              </div>
            </div>

            {/* 볼륨 버튼 (진행바 오른쪽 위) */}
            <div className="flex justify-end">
              <VolumeSlider
                volume={volume}
                isMuted={isMuted}
                onVolumeChange={setVolume}
                onToggleMute={toggleMute}
              />
            </div>

            {/* 프로그레스 바 */}
            <ProgressBar
              progress={progress}
              currentTime={currentTime}
              duration={duration}
              onSeek={seek}
            />

            {/* 재생 컨트롤 */}
            <div className="flex items-center justify-center gap-4">
              {/* 셔플 */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); toggleShuffle(); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                aria-label={isShuffled ? '셔플 끄기' : '셔플 켜기'}
              >
                <ShuffleIcon className="w-4 h-4" active={isShuffled} />
              </button>

              {/* 이전 트랙 */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); prevTrack(); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                aria-label="이전 트랙"
              >
                <PrevIcon />
              </button>

              {/* 재생/일시정지 */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); if (!isLoading) togglePlay(); }}
                disabled={isLoading}
                className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors disabled:opacity-50"
                aria-label={isPlaying ? '일시정지' : '재생'}
              >
                {isLoading ? (
                  <svg className="w-6 h-6 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                ) : isPlaying ? (
                  <PauseIcon className="w-6 h-6" />
                ) : (
                  <PlayIcon className="w-6 h-6" />
                )}
              </button>

              {/* 다음 트랙 */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); nextTrack(); }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                aria-label="다음 트랙"
              >
                <NextIcon />
              </button>

              {/* 반복 */}
              <button
                onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); cycleRepeatMode(); }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
                aria-label={`반복 모드: ${repeatMode}`}
              >
                <RepeatIcon className="w-4 h-4" mode={repeatMode} />
              </button>
            </div>

            {/* 탭 전환 버튼 (가사가 있을 때만 표시) */}
            {hasLyrics && (
              <div className="flex justify-center gap-2 mt-2">
                <button
                  onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setActiveTab('playlist'); }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors ${
                    activeTab === 'playlist'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  플레이리스트
                </button>
                <button
                  onMouseDown={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); setActiveTab('lyrics'); }}
                  className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                    activeTab === 'lyrics'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <LyricsIcon className="w-3 h-3" />
                  가사
                </button>
              </div>
            )}
          </div>
        ) : (
          // 트랙 미선택 상태 - 최소한의 플레이스홀더만 표시
          // "없습니다" 메시지는 아래 플레이리스트 영역에서만 표시
          <div className="py-4 flex justify-center">
            {isLoading && (
              <p className="text-muted-foreground text-sm">로딩 중...</p>
            )}
          </div>
        )}
      </div>

      {/* 장르 탭 (플레이리스트 탭이 활성화되어 있고 장르가 있을 때만 표시) */}
      {activeTab === 'playlist' && availableGenres.length > 0 && (
        <GenreTabs
          currentGenre={currentGenre}
          availableGenres={availableGenres}
          onGenreChange={changeGenre}
        />
      )}

      {/* 플레이리스트 또는 가사 */}
      <div className="max-h-64 overflow-y-auto">
        {activeTab === 'lyrics' && currentTrack ? (
          // 가사 탭
          <div className="h-64">
            <LyricsDisplay
              lyrics={currentTrack.lyrics}
              syncedLyrics={currentTrack.syncedLyrics}
              currentTime={currentTime}
            />
          </div>
        ) : (
          // 플레이리스트 탭
          <>
            {playlist.length > 0 ? (
              <div className="p-2">
                {playlist.map((track, index) => (
                  <TrackItem
                    key={track.id}
                    track={track}
                    index={index}
                    isActive={index === currentIndex}
                    isPlaying={isPlaying && index === currentIndex}
                    onPlay={playTrack}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                {isLoading ? '플레이리스트 로딩 중...' : '재생할 음악이 없습니다'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // createPortal로 body에 직접 렌더링 (Header와 완전 독립)
  return createPortal(dropdownContent, document.body);
}

// React.memo로 래핑하여 불필요한 리렌더링 방지
// Props가 없고 Zustand 선택자만 사용하므로 해당 상태가 변경될 때만 리렌더링
export const MusicPlayerDropdown = React.memo(MusicPlayerDropdownInner);

export default MusicPlayerDropdown;
