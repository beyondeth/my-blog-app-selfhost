import { SetMetadata } from "@nestjs/common";
import { RATE_LIMIT_METADATA_KEY } from "./rate-limit.constants";

export type RateLimitGroup =
  | "default"
  | "community-comment-write"
  | "community-comment-react"
  | "community-comment-manage"
  | string;

/**
 * Rate Limit 정책을 적용할 엔드포인트에 설정하는 데코레이터
 */
export const RateLimit = (group: RateLimitGroup = "default") =>
  SetMetadata(RATE_LIMIT_METADATA_KEY, group);
