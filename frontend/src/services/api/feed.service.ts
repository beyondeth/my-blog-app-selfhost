/**
 * 통합 피드 API 서비스
 *
 * @description 홈피드에서 블로그 포스트와 커뮤니티 포스트를 통합 조회
 *
 * **엔드포인트:**
 * - GET /feed - 통합 피드 조회
 *
 * **지원 기능:**
 * - 커서 기반 무한 스크롤
 * - 필터링 (전체/블로그/커뮤니티)
 * - 정렬 (최신순/인기순)
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

/**
 * 피드 소스 타입
 */
export type FeedSourceType = 'blog' | 'community';

/**
 * 피드 필터 타입
 */
export type FeedFilterType = 'all' | 'blog' | 'community';

/**
 * 피드 정렬 타입
 */
export type FeedSortType = 'recent' | 'hot' | 'top';

/**
 * 피드 기간 필터 타입
 */
export type FeedPeriodType = 'all' | 'daily' | 'weekly' | 'monthly';

/**
 * 피드 작성자 정보
 */
export interface FeedAuthor {
  id: string;
  username: string;
  profileImage?: string;
}

/**
 * 피드 블로그 정보 (블로그 포스트인 경우)
 */
export interface FeedBlog {
  id: string;
  slug: string;
  alias?: string;
  name: string;
}

/**
 * 피드 커뮤니티 정보 (커뮤니티 포스트인 경우)
 */
export interface FeedCommunity {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string;
  iconImageFit?: 'cover' | 'contain';
}

/**
 * 통합 피드 아이템
 */
export interface UnifiedFeedItem {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  tags?: string[];
  thumbnail?: string;
  youtubeVideoId?: string;
  images?: string[];
  sourceType: FeedSourceType;
  blog?: FeedBlog;
  community?: FeedCommunity;
  author: FeedAuthor;
  /** @deprecated upvoteCount 사용 권장 */
  likeCount: number;
  /** 업보트 수 */
  upvoteCount?: number;
  /** 다운보트 수 */
  downvoteCount?: number;
  /** 순투표 점수 (upvoteCount - downvoteCount) */
  score?: number;
  commentCount: number;
  viewCount: number;
  /** @deprecated userVote 사용 권장 */
  liked?: boolean;
  /** 사용자의 투표 상태 (upvote/downvote/null) */
  userVote?: 'upvote' | 'downvote' | null;
  createdAt: string;
  updatedAt: string;
  // 커뮤니티 포스트 전용 필드
  isNsfw?: boolean;
  isSpoiler?: boolean;
  isPinned?: boolean;
}

/**
 * 통합 피드 응답
 */
export interface UnifiedFeedResponse {
  items: UnifiedFeedItem[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
}

/**
 * 통합 피드 조회 파라미터
 */
export interface GetUnifiedFeedParams {
  cursor?: string;
  limit?: number;
  filter?: FeedFilterType;
  sort?: FeedSortType;
  period?: FeedPeriodType;
}

/**
 * 통합 피드 조회
 *
 * @param params 조회 파라미터
 * @param init Fetch 옵션 (Server Component에서 쿠키 전달 시 사용)
 * @returns 피드 응답
 *
 * @example
 * const feed = await getUnifiedFeed({ filter: 'all', sort: 'recent', limit: 20 });
 */
export async function getUnifiedFeed(
  params: GetUnifiedFeedParams = {},
  init?: RequestInit,
): Promise<UnifiedFeedResponse> {
  const { cursor, limit = 20, filter = 'all', sort = 'recent', period } = params;

  // 쿼리 파라미터 구성
  const queryParams = new URLSearchParams();
  if (cursor) queryParams.set('cursor', cursor);
  queryParams.set('limit', limit.toString());
  queryParams.set('filter', filter);
  queryParams.set('sort', sort);
  if (period && period !== 'all') queryParams.set('period', period);

  const response = await fetch(`${API_URL}/feed?${queryParams.toString()}`, {
    method: 'GET',
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`피드 조회 실패: ${response.status}`);
  }

  return response.json();
}

/**
 * Editor's Pick 목록 조회
 * @param limit 조회할 개수 (기본: 5)
 */
export async function getEditorPicks(limit: number = 5): Promise<{ posts: any[]; total: number }> {
  const response = await fetch(
    `${API_URL}/posts/editor-picks?limit=${limit}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error('Editor\'s Pick 목록을 불러올 수 없습니다.');
  }

  return response.json();
}
