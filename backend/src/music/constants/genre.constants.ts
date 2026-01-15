/**
 * 음악 장르 관련 상수
 *
 * 장르는 관리자가 음악별로 직접 지정
 * 기본 장르 없음 - DB에서 사용 중인 장르만 표시
 */

// Redis 캐시 키 생성
export const MUSIC_CACHE_KEYS = {
  // 전체 플레이리스트
  PLAYLIST_ALL: "music:playlist:all",
  // 장르별 플레이리스트 (prefix)
  PLAYLIST_BY_GENRE: (genre: string) => `music:playlist:${genre}`,
  // 사용 가능한 장르 목록
  GENRES_LIST: "music:genres",
} as const;

// 캐시 TTL (초 단위)
export const MUSIC_CACHE_TTL = {
  PLAYLIST: 5 * 60, // 5분
  GENRES: 10 * 60, // 10분
} as const;
