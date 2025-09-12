import { useQuery } from '@tanstack/react-query';
import { postsAPI } from '@/lib/api';

export function usePopularPosts(period: 'daily' | 'weekly' | 'monthly' = 'weekly', limit: number = 5) {
  return useQuery({
    queryKey: ['popular-posts', period, limit],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'}/posts/popular/${period}?limit=${limit}`,
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

      return response.json();
    },
    staleTime: period === 'daily' ? 60 * 60 * 1000 : period === 'weekly' ? 3 * 60 * 60 * 1000 : 6 * 60 * 60 * 1000, // 1시간, 3시간, 6시간
    gcTime: period === 'daily' ? 2 * 60 * 60 * 1000 : period === 'weekly' ? 6 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}