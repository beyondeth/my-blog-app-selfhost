const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export type PopularPeriod = "daily" | "weekly" | "monthly";

export interface PopularCommunityPostItem {
  id: string;
  title: string;
  slug: string;
  community?: {
    id: string;
    slug: string;
    name: string;
    iconUrl?: string;
  };
  author?: {
    id: string;
    username: string;
    profileImage?: string;
  };
}

export interface PopularCommunityPostsResponse {
  items: PopularCommunityPostItem[];
  total: number;
}

export async function getPopularCommunityPosts(
  period: PopularPeriod,
  limit: number = 5,
): Promise<PopularCommunityPostsResponse> {
  const response = await fetch(
    `${API_URL}/communities/popular/${period}?limit=${limit}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    throw new Error(`커뮤니티 인기글 조회 실패: ${response.status}`);
  }

  return response.json();
}
