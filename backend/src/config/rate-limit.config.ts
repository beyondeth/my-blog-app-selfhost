import { registerAs } from "@nestjs/config";

export interface RateLimitGroupPolicy {
  /** 허용 횟수 */
  limit: number;
  /** TTL (초) */
  ttl: number;
  /** 초 단위 블록 시간 (선택) */
  blockDuration?: number;
  /** 설명 (선택) */
  description?: string;
}

export interface RateLimitConfiguration {
  defaultBlockDuration: number;
  groups: Record<string, RateLimitGroupPolicy>;
}

const parseNumber = (value: string | undefined, fallback: number) => {
  const parsed = parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export default registerAs("rateLimit", (): RateLimitConfiguration => {
  const defaultBlockDuration = parseNumber(
    process.env.RATE_LIMIT_DEFAULT_BLOCK_DURATION,
    60,
  );

  return {
    defaultBlockDuration,
    groups: {
      default: {
        ttl: 60,
        limit: 120,
        blockDuration: defaultBlockDuration,
        description: "기본 Rate Limit 정책 (분당 120회)",
      },
      "community-comment-write": {
        ttl: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_WRITE_TTL,
          60,
        ),
        limit: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_WRITE_LIMIT,
          5,
        ),
        blockDuration: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_WRITE_BLOCK,
          120,
        ),
        description: "커뮤니티 댓글 작성/수정",
      },
      "community-comment-react": {
        ttl: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_REACT_TTL,
          60,
        ),
        limit: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_REACT_LIMIT,
          30,
        ),
        blockDuration: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_REACT_BLOCK,
          60,
        ),
        description: "커뮤니티 댓글 좋아요/싫어요",
      },
      "community-comment-manage": {
        ttl: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_MANAGE_TTL,
          60,
        ),
        limit: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_MANAGE_LIMIT,
          10,
        ),
        blockDuration: parseNumber(
          process.env.RATE_LIMIT_COMMUNITY_COMMENT_MANAGE_BLOCK,
          120,
        ),
        description: "커뮤니티 댓글 삭제 등 관리 작업",
      },
    },
  };
});
