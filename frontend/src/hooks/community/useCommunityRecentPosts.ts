'use client';

import { useQuery } from '@tanstack/react-query';
import { communityService } from '@/services/api/community.service';
import type { CommunityPost } from '@/types/community';

/**
 * 커뮤니티 최신글 조회 훅
 *
 * @description 사이드바 "내 커뮤니티" 섹션에서 각 커뮤니티별 최신글 표시용
 *
 * @param communitySlug 커뮤니티 slug
 * @param options.enabled 쿼리 활성화 여부 (기본: true)
 * @param options.limit 조회할 게시글 수 (기본: 3)
 */
export function useCommunityRecentPosts(
  communitySlug: string,
  options?: { enabled?: boolean; limit?: number }
) {
  const enabled = options?.enabled ?? true;
  const limit = options?.limit ?? 3;

  return useQuery<CommunityPost[]>({
    queryKey: ['community', communitySlug, 'recent-posts', limit],
    queryFn: async () => {
      const response = await communityService.getPosts(communitySlug, {
        limit,
        sortBy: 'newest',
      });
      return response.items;
    },
    enabled: enabled && !!communitySlug,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  });
}
