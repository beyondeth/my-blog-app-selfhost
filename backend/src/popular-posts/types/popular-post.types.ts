export type PopularPeriod = "daily" | "weekly" | "monthly";

export type PopularSourceType = "blog" | "community";

export interface PopularScoreRow {
  postId: string;
  score: number;
  metaJson: Record<string, unknown>;
}

export interface PopularCachePayload {
  generatedAt: string;
  items: Record<string, unknown>[];
}

export interface PopularPostsResponse {
  posts: Record<string, unknown>[];
  total: number;
}

export interface PopularCommunityResponse {
  items: Record<string, unknown>[];
  total: number;
}
