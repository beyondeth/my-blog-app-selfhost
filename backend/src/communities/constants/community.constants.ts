/**
 * 커뮤니티 시스템 상수 정의
 *
 * @description 커뮤니티 관련 제한 값 및 설정 상수
 */

export const COMMUNITY_LIMITS = {
  /**
   * 사용자당 최대 가입 가능 커뮤니티 수
   * - Reddit 스타일: 무제한이지만 우리는 50개로 제한
   * - 스팸 방지 및 서비스 품질 유지 목적
   */
  MAX_COMMUNITIES_PER_USER: 50,

  /**
   * 커뮤니티당 최대 규칙 수
   */
  MAX_RULES_PER_COMMUNITY: 15,

  /**
   * 댓글 최대 깊이 (대댓글 단계)
   * - 1: 대댓글만 허용 (Reddit과 동일)
   */
  MAX_COMMENT_DEPTH: 1,

  /**
   * 게시물 최대 길이 (HTML 기준, 문자 수)
   */
  MAX_POST_CONTENT_LENGTH: 200000,

  /**
   * 댓글 최대 길이 (문자 수)
   */
  MAX_COMMENT_LENGTH: 10000,

  /**
   * 커뮤니티 설명 최대 길이
   */
  MAX_DESCRIPTION_LENGTH: 5000,

  /**
   * 규칙 설명 최대 길이
   */
  MAX_RULE_DESCRIPTION_LENGTH: 1000,

  /**
   * 임시 차단 최대 기간 (일)
   */
  MAX_BAN_DURATION_DAYS: 365,

  /**
   * 플레어 최대 개수
   */
  MAX_FLAIRS_PER_COMMUNITY: 100,

  /**
   * 게시물 태그 최대 개수
   */
  MAX_TAGS_PER_POST: 10,
} as const;

/**
 * 커뮤니티 캐시 TTL 설정 (초)
 */
export const COMMUNITY_CACHE_TTL = {
  /**
   * 커뮤니티 상세 정보
   */
  COMMUNITY_DETAIL: 300, // 5분

  /**
   * 커뮤니티 목록
   */
  COMMUNITY_LIST: 60, // 1분

  /**
   * 멤버십 정보
   */
  MEMBERSHIP: 60, // 1분

  /**
   * 모더레이터 목록
   */
  MODERATOR_LIST: 300, // 5분

  /**
   * 게시물 목록
   */
  POST_LIST: 30, // 30초

  /**
   * 댓글 목록
   */
  COMMENT_LIST: 30, // 30초
} as const;
