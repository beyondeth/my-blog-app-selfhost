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
    // Optional auth 경로에서도 소유자 컨텍스트를 전달하기 위해 쿠키 포함
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch related posts: ${response.status}`);
  }

  return response.json();
}
