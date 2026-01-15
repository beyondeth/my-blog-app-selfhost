export interface RateLimitGroupPolicy {
  ttl: number; // seconds
  limit: number;
  blockDuration?: number; // seconds
  description?: string;
}

export interface RateLimitConfig {
  defaultBlockDuration: number;
  groups: Record<string, RateLimitGroupPolicy>;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining?: number;
  retryAfter?: number;
  resetAfter?: number;
  blocked?: boolean;
}
