/**
 * 음악 플레이어 관련 타입 정의
 * 엔터프라이즈급 설계 - 불변성 보장을 위한 readonly 적용
 */

// ============================================
// 가사 타입
// ============================================

/**
 * 동기화된 가사 라인
 * time: 밀리초 단위 타임스탬프
 * text: 해당 시점의 가사 텍스트
 */
export interface SyncedLyricLine {
  readonly time: number;
  readonly text: string;
}

// ============================================
// 트랙 타입
// ============================================

/**
 * 플레이리스트 트랙
 */
export interface Track {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly duration?: number; // 초 단위
  readonly audioUrl: string;
  readonly coverUrl?: string;
  readonly order: number;
  readonly genre?: string; // 장르
  readonly lyrics?: string; // 일반 텍스트 가사
  readonly syncedLyrics?: SyncedLyricLine[]; // 동기화된 가사
}

// ============================================
// 플레이어 상태 타입
// ============================================

/**
 * 반복 모드
 */
export type RepeatMode = 'none' | 'all' | 'one';

/**
 * 플레이어 상태
 */
export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/**
 * 오디오 에러 코드
 */
export type AudioErrorCode = 'NETWORK' | 'DECODE' | 'NOT_FOUND' | 'AUTOPLAY_BLOCKED' | 'UNKNOWN';

/**
 * 오디오 에러 정보
 */
export interface AudioError {
  readonly code: AudioErrorCode;
  readonly message: string;
}

// ============================================
// Store 상태 타입
// ============================================

/**
 * 음악 플레이어 Store 상태
 */
export interface MusicPlayerState {
  // 플레이리스트
  readonly playlist: readonly Track[];
  readonly currentTrackIndex: number;

  // 표시용 트랙 (장르 변경 시 플레이어 UI 유지용)
  // 빈 플레이리스트에서도 마지막 트랙 정보를 유지하여 UI 축소 방지
  readonly displayedTrack: Track | null;

  // 장르 관련
  readonly currentGenre: string | null; // 현재 선택된 장르 (null = 전체)
  readonly availableGenres: readonly string[]; // 사용 가능한 장르 목록

  // 재생 상태
  readonly status: PlayerStatus;
  readonly currentTime: number;
  readonly duration: number;

  // 설정
  readonly volume: number; // 0-1
  readonly isMuted: boolean;
  readonly repeatMode: RepeatMode;
  readonly isShuffled: boolean;
  readonly shuffledIndices: readonly number[];

  // UI 상태
  readonly isDropdownOpen: boolean;

  // 에러 상태
  readonly error: AudioError | null;
}

/**
 * 음악 플레이어 Store 액션
 */
export interface MusicPlayerActions {
  // 재생 제어
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stop: () => void;

  // 트랙 제어
  playTrack: (index: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;

  // 시간 제어
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;

  // 볼륨 제어
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  // 재생 모드
  setRepeatMode: (mode: RepeatMode) => void;
  cycleRepeatMode: () => void;
  toggleShuffle: () => void;

  // 플레이리스트 관리
  setPlaylist: (tracks: Track[]) => void;
  clearPlaylist: () => void;

  // 장르 관리
  setCurrentGenre: (genre: string | null) => void;
  setAvailableGenres: (genres: string[]) => void;

  // UI 제어
  setDropdownOpen: (open: boolean) => void;
  toggleDropdown: () => void;

  // 상태 관리
  setStatus: (status: PlayerStatus) => void;
  setError: (error: AudioError | null) => void;
  reset: () => void;
}

/**
 * 음악 플레이어 Store 전체 타입
 */
export type MusicPlayerStore = MusicPlayerState & MusicPlayerActions;

// ============================================
// API 응답 타입
// ============================================

/**
 * 플레이리스트 API 응답
 */
export interface PlaylistResponse {
  readonly tracks: Track[];
}

/**
 * 관리자 음악 정보
 */
export interface AdminMusic {
  readonly id: string;
  readonly originalName: string;
  readonly fileSize: number;
  readonly duration?: number;
  readonly title?: string;
  readonly artist?: string;
  readonly album?: string;
  readonly year?: number;
  readonly genre?: string; // ID3 메타데이터 장르 (참조용)
  readonly displayTitle?: string;
  readonly displayArtist?: string;
  readonly displayGenre?: string; // 관리자 지정 장르
  readonly isActive: boolean;
  readonly order: number;
  readonly audioUrl: string;
  readonly coverUrl?: string;
  readonly createdAt: string;
  readonly lyrics?: string; // 일반 텍스트 가사
  readonly syncedLyrics?: SyncedLyricLine[]; // 동기화된 가사
}

/**
 * 음악 업로드 URL 응답
 */
export interface MusicUploadUrlResponse {
  readonly uploadUrl: string;
  readonly fileKey: string;
  readonly expiresIn: number;
}

/**
 * 음악 업로드 요청
 */
export interface CreateMusicUploadUrlRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * 음악 업로드 완료 요청
 */
export interface MusicUploadCompleteRequest {
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

/**
 * 음악 수정 요청
 */
export interface UpdateMusicRequest {
  displayTitle?: string;
  displayArtist?: string;
  displayGenre?: string; // 관리자 지정 장르
  isActive?: boolean;
  order?: number;
}

/**
 * 음악 순서 변경 요청
 */
export interface ReorderMusicRequest {
  items: Array<{
    id: string;
    order: number;
  }>;
}

// ============================================
// 유틸리티 타입
// ============================================

/**
 * 시간 포맷팅 (초 -> mm:ss)
 */
export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 파일 크기 포맷팅
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
