/**
 * 평판 시스템 - Redis 키 중앙 관리
 *
 * 모든 평판 관련 Redis 키를 이 파일에서만 정의합니다.
 * 키 충돌 방지 및 일관성 유지를 위해 모든 서비스는
 * 이 파일에서 import하여 사용해야 합니다.
 *
 * @example
 * import { repKeys } from './reputation.keys';
 * const key = repKeys.leaderboard('l7');
 * // 결과: 'rep:leaderboard:l7'
 */

/**
 * 리더보드 기간 타입
 */
export type LeaderboardPeriod = "l7" | "l30" | "l90" | "all";

/**
 * 평판 시스템 Redis 키 정의
 */
export const repKeys = {
  /**
   * 리더보드 Sorted Set 키
   * @param period - 기간 ('l7' | 'l30')
   * @returns Redis 키 문자열
   * @example repKeys.leaderboard('l7') => 'rep:leaderboard:l7'
   */
  leaderboard: (period: LeaderboardPeriod): string =>
    `rep:leaderboard:${period}`,

  /**
   * 사용자 활동 쿨다운 키
   * 동일 액션 반복 방지 (예: 동일 포스트 연속 좋아요)
   * @param userId - 사용자 ID
   * @param action - 액션 타입
   * @returns Redis 키 문자열
   */
  userActivityCooldown: (userId: string, action: string): string =>
    `rep:cooldown:${action}:${userId}`,

  /**
   * API Rate Limit 키
   * 평판 관련 API 요청 제한용
   * @param userId - 사용자 ID
   * @returns Redis 키 문자열
   */
  apiRateLimit: (userId: string): string => `rep:ratelimit:${userId}`,

  /**
   * 사용자 타이틀 캐시 키
   * 현재 활성화된 타이틀 목록 캐싱
   * @param userId - 사용자 ID
   * @returns Redis 키 문자열
   */
  titleCache: (userId: string): string => `rep:title:${userId}`,

  /**
   * 사용자 점수 요약 캐시 키
   * 기간별 총점 캐싱
   * @param userId - 사용자 ID
   * @param period - 기간
   * @returns Redis 키 문자열
   */
  scoreSummary: (userId: string, period: string): string =>
    `rep:score:${period}:${userId}`,
};

/**
 * Redis TTL 상수 (초 단위)
 */
export const repTTL = {
  /** 리더보드 캐시 TTL: 1시간 */
  leaderboard: 3600,
  /** 활동 쿨다운 TTL: 1분 */
  cooldown: 60,
  /** API Rate Limit TTL: 1분 */
  rateLimit: 60,
  /** 타이틀 캐시 TTL: 5분 */
  titleCache: 300,
  /** 점수 요약 캐시 TTL: 10분 */
  scoreSummary: 600,
};
