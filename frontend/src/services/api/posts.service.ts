/**
 * 포스트 API 서비스
 *
 * @description 포스트 관련 API 호출 처리
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

export interface RelatedPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  thumbnail?: string; // Corrected from thumbnailUrl
  category?: string; // Added category
  createdAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  blog: {
    id: string;
    name: string;
    slug: string;
  };
  author: {
    id: string;
    username: string;
    profileImage?: string;
  };
  metadata?: {
    readingTimeMinutes?: number;
  };
}

/**
 * 연관 포스트 조회
 * GET /posts/:id/related
 */
export async function getRelatedPosts(
  postId: string,
  limit: number = 6
): Promise<RelatedPost[]> {
  const response = await fetch(`${API_URL}/posts/${postId}/related?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    // Public API이므로 credentials 불필요할 수 있으나, 일관성을 위해 유지하거나 필요에 따라 제거
    // GET /posts/:id/related는 Public이므로 토큰 없이도 호출 가능
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch related posts: ${response.status}`);
  }

  return response.json();
}
