/**
 * VoteType Enum
 *
 * @description 포스트 투표 타입을 정의합니다.
 *
 * Reddit 스타일의 업보트/다운보트 시스템:
 * - UPVOTE: 긍정적 투표 (기존 좋아요)
 * - DOWNVOTE: 부정적 투표 (기존 싫어요)
 *
 * @note 기존 LikeType enum (LIKE, DISLIKE)을 대체합니다.
 * 마이그레이션으로 기존 데이터는 자동 변환됩니다.
 */
export enum VoteType {
  /** 긍정적 투표 (이전 LIKE) */
  UPVOTE = "upvote",

  /** 부정적 투표 (이전 DISLIKE) */
  DOWNVOTE = "downvote",
}
