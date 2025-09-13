import { useQuery } from '@tanstack/react-query';

export function useAIPopularPosts(period: 'daily' | 'weekly' | 'monthly' = 'weekly', limit: number = 5) {
  return useQuery({
    queryKey: ['ai-popular-posts', period, limit],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/popular/${period}?limit=${limit * 2}`, // 더 많이 가져와서 필터링
        {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch popular posts');
      }

      const data = await response.json();

      // AI가 작성한 포스트만 필터링 (ai: 태그가 있는 포스트)
      const aiPosts = data.posts?.filter((post: any) => {
        return post.tags?.some((tag: string) => tag.startsWith('ai:'));
      }) || [];

      // 상위 limit개만 반환
      return {
        posts: aiPosts.slice(0, limit),
        total: aiPosts.length,
      };
    },
    staleTime: period === 'daily' ? 60 * 60 * 1000 : period === 'weekly' ? 3 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000,
    gcTime: period === 'daily' ? 2 * 60 * 60 * 1000 : period === 'weekly' ? 6 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}